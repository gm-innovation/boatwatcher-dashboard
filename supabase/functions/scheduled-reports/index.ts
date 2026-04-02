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

      // report_type pode ser comma-separated
      const types = String(report_type).split(',').map(t => t.trim()).filter(Boolean);
      const results = [];

      for (const rt of types) {
        const reportData = await generateReport(supabase, rt, project_id, start, end);

        const { data: saved, error: saveErr } = await supabase
          .from('generated_reports')
          .insert({
            report_type: rt,
            project_id: project_id || null,
            date_range_start: start,
            date_range_end: end,
            filters: { manual: true },
            data: reportData,
          })
          .select()
          .single();

        if (saveErr) throw saveErr;
        results.push(saved);
      }

      return new Response(JSON.stringify({ success: true, reports: results }), {
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
        const lookbackDays = schedule.filters?.lookback_days ?? getLookbackForFrequency(schedule.frequency);
        const { startDate, endDate } = getDateRangeFromLookback(lookbackDays);
        const nextRun = calculateNextRun(schedule.frequency);

        // report_type pode ser comma-separated
        const types = String(schedule.report_type).split(',').map(t => t.trim()).filter(Boolean);
        let totalRecords = 0;

        for (const rt of types) {
          const reportData = await generateReport(supabase, rt, schedule.project_id, startDate, endDate);
          totalRecords += reportData.total_records || 0;

          await supabase.from('generated_reports').insert({
            report_type: rt,
            project_id: schedule.project_id,
            date_range_start: startDate,
            date_range_end: endDate,
            filters: { schedule_id: schedule.id, frequency: schedule.frequency },
            data: reportData,
          });
        }

        // Update schedule timestamps
        await supabase
          .from('report_schedules')
          .update({ last_run_at: new Date().toISOString(), next_run_at: nextRun.toISOString() })
          .eq('id', schedule.id);

        // Send notification emails to recipients
        if (schedule.recipients && schedule.recipients.length > 0) {
          await sendNotificationEmails(supabase, schedule, types, totalRecords, startDate, endDate);
        }

        results.push({
          schedule_id: schedule.id,
          name: schedule.name,
          success: true,
          report_types: types,
          records: totalRecords,
          next_run: nextRun.toISOString(),
        });
      } catch (err: unknown) {
        console.error(`[scheduled-reports] Error: ${schedule.id}`, err);
        results.push({ schedule_id: schedule.id, name: schedule.name, success: false, error: (err as Error).message });
      }
    }

    return new Response(JSON.stringify({ success: true, schedulesProcessed: schedules.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[scheduled-reports] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// ─── Helpers ───

function getLookbackForFrequency(frequency: string): number {
  switch (frequency) {
    case 'daily': return 1;
    case 'weekly': return 7;
    case 'biweekly': return 15;
    case 'monthly': return 30;
    default: return 1;
  }
}

function getDateRangeFromLookback(days: number) {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 3600000).toISOString();
  const endDate = now.toISOString();
  return { startDate, endDate };
}

function calculateNextRun(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case 'daily': return new Date(now.getTime() + 24 * 3600000);
    case 'weekly': return new Date(now.getTime() + 7 * 24 * 3600000);
    case 'biweekly': return new Date(now.getTime() + 15 * 24 * 3600000);
    case 'monthly': { const n = new Date(now); n.setMonth(n.getMonth() + 1); return n; }
    default: return new Date(now.getTime() + 24 * 3600000);
  }
}

// ─── Report Generation ───

async function generateReport(supabase: any, reportType: string, projectId: string | null, startDate: string, endDate: string) {
  switch (reportType) {
    case 'presence': return generatePresenceReport(supabase, projectId, startDate, endDate);
    case 'workers_simple': return generateWorkersSimpleReport(supabase, projectId);
    case 'workers_detailed': return generateWorkersDetailedReport(supabase, projectId);
    case 'company': return generateCompanyReport(supabase, projectId);
    case 'all_workers': return generateAllWorkersReport(supabase);
    default: throw new Error(`Unknown report type: ${reportType}`);
  }
}

// Visão Geral — access logs summary
async function generatePresenceReport(supabase: any, projectId: string | null, startDate: string, endDate: string) {
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

  const workerMap: Record<string, any> = {};
  for (const log of (logs || [])) {
    const key = log.worker_id || log.worker_name || 'unknown';
    if (!workerMap[key]) {
      workerMap[key] = {
        worker_id: log.worker_id, worker_name: log.worker_name || 'Desconhecido',
        worker_document: log.worker_document, entries: 0, exits: 0, total_events: 0,
        first_event: log.timestamp, last_event: log.timestamp,
      };
    }
    workerMap[key].total_events++;
    if (log.direction === 'entry') workerMap[key].entries++;
    if (log.direction === 'exit') workerMap[key].exits++;
    workerMap[key].last_event = log.timestamp;
  }

  const workerIds = Object.values(workerMap).map((w: any) => w.worker_id).filter(Boolean);
  if (workerIds.length > 0) {
    const { data: workers } = await supabase
      .from('workers')
      .select('id, name, company_id, companies:company_id(name)')
      .in('id', workerIds);
    for (const w of (workers || [])) {
      if (workerMap[w.id]) {
        workerMap[w.id].company_name = (w as any).companies?.name || null;
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

// Trabalhadores Simples — basic worker list
async function generateWorkersSimpleReport(supabase: any, projectId: string | null) {
  let query = supabase
    .from('workers')
    .select('id, name, document_number, status, company_id, companies:company_id(name), job_function_id, job_functions:job_function_id(name)')
    .order('name');

  if (projectId) {
    query = query.contains('allowed_project_ids', [projectId]);
  }

  const { data: workers, error } = await query;
  if (error) throw error;

  const active = (workers || []).filter((w: any) => w.status === 'active').length;
  const inactive = (workers || []).filter((w: any) => w.status !== 'active').length;

  return {
    report_type: 'workers_simple',
    period: { start: new Date().toISOString(), end: new Date().toISOString() },
    total_records: (workers || []).length,
    summary: { active, inactive },
    details: (workers || []).map((w: any) => ({
      name: w.name,
      document_number: w.document_number,
      status: w.status,
      company_name: (w as any).companies?.name || null,
      job_function: (w as any).job_functions?.name || null,
    })),
  };
}

// Trabalhadores Detalhado — workers with documents
async function generateWorkersDetailedReport(supabase: any, projectId: string | null) {
  let query = supabase
    .from('workers')
    .select('*, companies:company_id(name), job_functions:job_function_id(name)')
    .order('name');

  if (projectId) {
    query = query.contains('allowed_project_ids', [projectId]);
  }

  const { data: workers, error } = await query;
  if (error) throw error;

  // Fetch documents for all workers
  const workerIds = (workers || []).map((w: any) => w.id);
  let docs: any[] = [];
  if (workerIds.length > 0) {
    const { data } = await supabase
      .from('worker_documents')
      .select('worker_id, document_type, expiry_date, status')
      .in('worker_id', workerIds);
    docs = data || [];
  }

  const docsByWorker: Record<string, any[]> = {};
  for (const d of docs) {
    if (!docsByWorker[d.worker_id]) docsByWorker[d.worker_id] = [];
    docsByWorker[d.worker_id].push(d);
  }

  const now = new Date();
  let expired = 0, expiring = 0, valid = 0;

  const details = (workers || []).map((w: any) => {
    const wDocs = docsByWorker[w.id] || [];
    for (const d of wDocs) {
      if (d.expiry_date) {
        if (new Date(d.expiry_date) < now) expired++;
        else if (new Date(d.expiry_date) < new Date(now.getTime() + 30 * 24 * 3600000)) expiring++;
        else valid++;
      }
    }
    return {
      name: w.name,
      document_number: w.document_number,
      status: w.status,
      birth_date: w.birth_date,
      blood_type: w.blood_type,
      gender: w.gender,
      role: w.role,
      company_name: (w as any).companies?.name || null,
      job_function: (w as any).job_functions?.name || null,
      documents: wDocs.map((d: any) => ({
        type: d.document_type,
        expiry_date: d.expiry_date,
        status: d.status,
      })),
    };
  });

  return {
    report_type: 'workers_detailed',
    period: { start: now.toISOString(), end: now.toISOString() },
    total_records: (workers || []).length,
    summary: { total_workers: (workers || []).length, documents_valid: valid, documents_expired: expired, documents_expiring: expiring },
    details,
  };
}

// Empresas — company report
async function generateCompanyReport(supabase: any, projectId: string | null) {
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, cnpj, status, type, contact_email, responsible_name')
    .order('name');
  if (error) throw error;

  // Count workers per company
  const { data: workers } = await supabase.from('workers').select('id, company_id, status');
  const workersByCompany: Record<string, { total: number; active: number }> = {};
  for (const w of (workers || [])) {
    if (!w.company_id) continue;
    if (!workersByCompany[w.company_id]) workersByCompany[w.company_id] = { total: 0, active: 0 };
    workersByCompany[w.company_id].total++;
    if (w.status === 'active') workersByCompany[w.company_id].active++;
  }

  const details = (companies || []).map((c: any) => ({
    name: c.name,
    cnpj: c.cnpj,
    status: c.status,
    type: c.type,
    contact_email: c.contact_email,
    responsible_name: c.responsible_name,
    total_workers: workersByCompany[c.id]?.total || 0,
    active_workers: workersByCompany[c.id]?.active || 0,
  }));

  return {
    report_type: 'company',
    period: { start: new Date().toISOString(), end: new Date().toISOString() },
    total_records: (companies || []).length,
    summary: {
      total_companies: (companies || []).length,
      total_workers: Object.values(workersByCompany).reduce((s, c) => s + c.total, 0),
    },
    details,
  };
}

// Todos Trabalhadores — all workers across all projects
async function generateAllWorkersReport(supabase: any) {
  const { data: workers, error } = await supabase
    .from('workers')
    .select('id, name, document_number, status, company_id, companies:company_id(name), job_function_id, job_functions:job_function_id(name), allowed_project_ids')
    .order('name');
  if (error) throw error;

  const active = (workers || []).filter((w: any) => w.status === 'active').length;

  return {
    report_type: 'all_workers',
    period: { start: new Date().toISOString(), end: new Date().toISOString() },
    total_records: (workers || []).length,
    summary: { total: (workers || []).length, active, inactive: (workers || []).length - active },
    details: (workers || []).map((w: any) => ({
      name: w.name,
      document_number: w.document_number,
      status: w.status,
      company_name: (w as any).companies?.name || null,
      job_function: (w as any).job_functions?.name || null,
      project_count: (w.allowed_project_ids || []).length,
    })),
  };
}

// ─── Email Notifications ───

async function sendNotificationEmails(supabase: any, schedule: any, reportTypes: string[], totalRecords: number, startDate: string, endDate: string) {
  const typeLabels: Record<string, string> = {
    presence: 'Visão Geral',
    workers_simple: 'Trabalhadores Simples',
    workers_detailed: 'Trabalhadores Detalhado',
    company: 'Empresas',
    all_workers: 'Todos Trabalhadores',
  };

  const typesFormatted = reportTypes.map(t => typeLabels[t] || t).join(', ');
  const start = new Date(startDate).toLocaleDateString('pt-BR');
  const end = new Date(endDate).toLocaleDateString('pt-BR');

  for (const email of schedule.recipients) {
    try {
      // Create internal notification
      await supabase.from('notifications').insert({
        title: `Relatório "${schedule.name}" gerado`,
        message: `Relatório(s): ${typesFormatted}. Período: ${start} a ${end}. Total de registros: ${totalRecords}.`,
        type: 'report',
        priority: 'low',
      });

      console.log(`[scheduled-reports] Notification created for schedule "${schedule.name}"`);
    } catch (err) {
      console.error(`[scheduled-reports] Failed to notify for ${email}:`, err);
    }
  }
}
