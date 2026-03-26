import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { schedule_id, manual = false, report_type, project_id, date_range_start, date_range_end } = body;

    console.log('[scheduled-reports] Starting...', { schedule_id, manual, report_type });

    // Manual generation without schedule
    if (manual && report_type && !schedule_id) {
      const start = date_range_start || new Date(Date.now() - 24 * 3600000).toISOString();
      const end = date_range_end || new Date().toISOString();
      
      const reportData = await generateReport(supabase, report_type, project_id, start, end);
      
      const { data: saved, error: saveErr } = await supabase
        .from('generated_reports')
        .insert({
          report_type,
          project_id: project_id || null,
          date_range_start: start,
          date_range_end: end,
          filters: { manual: true },
          data: reportData,
        })
        .select()
        .single();

      if (saveErr) throw saveErr;

      return new Response(JSON.stringify({ success: true, report: saved }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Schedule-based generation
    let schedules;
    if (schedule_id) {
      const { data, error } = await supabase
        .from('report_schedules')
        .select('*')
        .eq('id', schedule_id)
        .single();
      if (error) throw error;
      schedules = [data];
    } else {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('report_schedules')
        .select('*')
        .eq('is_active', true)
        .or(`next_run_at.is.null,next_run_at.lte.${now}`);
      if (error) throw error;
      schedules = data || [];
    }

    console.log(`[scheduled-reports] ${schedules.length} schedules to process`);
    const results = [];

    for (const schedule of schedules) {
      try {
        const { startDate, endDate } = getDateRangeForFrequency(schedule.frequency);
        const reportData = await generateReport(supabase, schedule.report_type, schedule.project_id, startDate, endDate);
        const nextRun = calculateNextRun(schedule.frequency);

        // Save snapshot
        await supabase.from('generated_reports').insert({
          report_type: schedule.report_type,
          project_id: schedule.project_id,
          date_range_start: startDate,
          date_range_end: endDate,
          filters: { schedule_id: schedule.id, frequency: schedule.frequency },
          data: reportData,
        });

        // Update schedule timestamps
        await supabase
          .from('report_schedules')
          .update({ last_run_at: new Date().toISOString(), next_run_at: nextRun.toISOString() })
          .eq('id', schedule.id);

        results.push({ schedule_id: schedule.id, name: schedule.name, success: true, records: reportData.total_records, next_run: nextRun.toISOString() });
      } catch (err) {
        console.error(`[scheduled-reports] Error: ${schedule.id}`, err);
        results.push({ schedule_id: schedule.id, name: schedule.name, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, schedulesProcessed: schedules.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[scheduled-reports] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

function getDateRangeForFrequency(frequency: string) {
  const now = new Date();
  let startDate: string;
  const endDate = now.toISOString();

  switch (frequency) {
    case 'daily':
      startDate = new Date(now.getTime() - 24 * 3600000).toISOString();
      break;
    case 'weekly':
      startDate = new Date(now.getTime() - 7 * 24 * 3600000).toISOString();
      break;
    case 'monthly':
      const m = new Date(now);
      m.setMonth(m.getMonth() - 1);
      startDate = m.toISOString();
      break;
    default:
      startDate = new Date(now.getTime() - 24 * 3600000).toISOString();
  }
  return { startDate, endDate };
}

function calculateNextRun(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case 'daily': return new Date(now.getTime() + 24 * 3600000);
    case 'weekly': return new Date(now.getTime() + 7 * 24 * 3600000);
    case 'monthly': { const n = new Date(now); n.setMonth(n.getMonth() + 1); return n; }
    default: return new Date(now.getTime() + 24 * 3600000);
  }
}

async function generateReport(supabase: any, reportType: string, projectId: string | null, startDate: string, endDate: string) {
  switch (reportType) {
    case 'presence': return generatePresenceReport(supabase, projectId, startDate, endDate);
    case 'access': return generateAccessReport(supabase, projectId, startDate, endDate);
    case 'compliance': return generateComplianceReport(supabase, projectId);
    case 'device': return generateDeviceReport(supabase, projectId);
    default: throw new Error(`Unknown report type: ${reportType}`);
  }
}

async function generatePresenceReport(supabase: any, projectId: string | null, startDate: string, endDate: string) {
  // Get access logs in range
  let query = supabase
    .from('access_logs')
    .select('*')
    .gte('timestamp', startDate)
    .lte('timestamp', endDate)
    .eq('access_status', 'granted')
    .order('timestamp', { ascending: true });

  if (projectId) {
    const { data: devices } = await supabase.from('devices').select('id').eq('project_id', projectId);
    const deviceIds = (devices || []).map((d: any) => d.id);
    if (deviceIds.length > 0) query = query.in('device_id', deviceIds);
  }

  const { data: logs, error } = await query;
  if (error) throw error;

  // Enrich: group by worker
  const workerMap: Record<string, any> = {};
  for (const log of (logs || [])) {
    const key = log.worker_id || log.worker_name || 'unknown';
    if (!workerMap[key]) {
      workerMap[key] = {
        worker_id: log.worker_id,
        worker_name: log.worker_name || 'Desconhecido',
        worker_document: log.worker_document,
        entries: 0, exits: 0, total_events: 0,
        first_event: log.timestamp, last_event: log.timestamp,
      };
    }
    workerMap[key].total_events++;
    if (log.direction === 'entry') workerMap[key].entries++;
    if (log.direction === 'exit') workerMap[key].exits++;
    workerMap[key].last_event = log.timestamp;
  }

  // Enrich with company info
  const workerIds = Object.values(workerMap).map((w: any) => w.worker_id).filter(Boolean);
  if (workerIds.length > 0) {
    const { data: workers } = await supabase
      .from('workers')
      .select('id, name, company_id, companies:company_id(name)')
      .in('id', workerIds);

    for (const w of (workers || [])) {
      const key = w.id;
      if (workerMap[key]) {
        workerMap[key].company_name = (w as any).companies?.name || null;
      }
    }
  }

  const details = Object.values(workerMap);
  return {
    report_type: 'presence',
    period: { start: startDate, end: endDate },
    total_records: (logs || []).length,
    unique_workers: details.length,
    summary: {
      total_entries: details.reduce((s: number, d: any) => s + d.entries, 0),
      total_exits: details.reduce((s: number, d: any) => s + d.exits, 0),
    },
    details,
  };
}

async function generateAccessReport(supabase: any, projectId: string | null, startDate: string, endDate: string) {
  let query = supabase
    .from('access_logs')
    .select('*')
    .gte('timestamp', startDate)
    .lte('timestamp', endDate)
    .order('timestamp', { ascending: false })
    .limit(1000);

  if (projectId) {
    const { data: devices } = await supabase.from('devices').select('id').eq('project_id', projectId);
    const deviceIds = (devices || []).map((d: any) => d.id);
    if (deviceIds.length > 0) query = query.in('device_id', deviceIds);
  }

  const { data: logs, error } = await query;
  if (error) throw error;

  const granted = (logs || []).filter((l: any) => l.access_status === 'granted').length;
  const denied = (logs || []).filter((l: any) => l.access_status === 'denied').length;

  return {
    report_type: 'access',
    period: { start: startDate, end: endDate },
    total_records: (logs || []).length,
    summary: { granted, denied },
    details: (logs || []).map((l: any) => ({
      timestamp: l.timestamp,
      worker_name: l.worker_name,
      worker_document: l.worker_document,
      direction: l.direction,
      access_status: l.access_status,
      device_name: l.device_name,
      reason: l.reason,
    })),
  };
}

async function generateComplianceReport(supabase: any, projectId: string | null) {
  const { data: docs, error } = await supabase
    .from('worker_documents')
    .select('*, workers:worker_id(name, company_id, companies:company_id(name))')
    .order('expiry_date', { ascending: true });

  if (error) throw error;

  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 3600000);
  let valid = 0, expired = 0, expiring = 0, noDate = 0;

  const details = (docs || []).map((d: any) => {
    let status = 'valid';
    if (!d.expiry_date) { noDate++; status = 'no_date'; }
    else if (new Date(d.expiry_date) < now) { expired++; status = 'expired'; }
    else if (new Date(d.expiry_date) < thirtyDays) { expiring++; status = 'expiring'; }
    else { valid++; }

    return {
      worker_name: d.workers?.name || 'Desconhecido',
      company_name: (d.workers as any)?.companies?.name || null,
      document_type: d.document_type,
      expiry_date: d.expiry_date,
      compliance_status: status,
    };
  });

  return {
    report_type: 'compliance',
    period: { start: now.toISOString(), end: now.toISOString() },
    total_records: (docs || []).length,
    summary: { valid, expired, expiring, no_date: noDate },
    details,
  };
}

async function generateDeviceReport(supabase: any, projectId: string | null) {
  let query = supabase.from('devices').select('*').order('name');
  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query;
  if (error) throw error;

  const online = (data || []).filter((d: any) => d.status === 'online').length;
  const offline = (data || []).filter((d: any) => d.status === 'offline').length;

  return {
    report_type: 'device',
    period: { start: new Date().toISOString(), end: new Date().toISOString() },
    total_records: (data || []).length,
    summary: { online, offline, error: (data || []).filter((d: any) => d.status === 'error').length },
    details: (data || []).map((d: any) => ({
      name: d.name, status: d.status, type: d.type,
      location: d.location, ip: d.controlid_ip_address,
      last_event: d.last_event_timestamp,
    })),
  };
}
