import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportData {
  schedule_id: string;
  report_type: string;
  project_id: string | null;
  filters: Record<string, any>;
  recipients: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { schedule_id, manual = false } = await req.json().catch(() => ({}));

    console.log('[scheduled-reports] Starting report generation...');

    // Get schedules to run
    let schedules;
    
    if (schedule_id) {
      // Run specific schedule
      const { data, error } = await supabase
        .from('report_schedules')
        .select('*')
        .eq('id', schedule_id)
        .single();
      
      if (error) throw error;
      schedules = [data];
    } else {
      // Get all due schedules
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('report_schedules')
        .select('*')
        .eq('is_active', true)
        .or(`next_run_at.is.null,next_run_at.lte.${now}`);
      
      if (error) throw error;
      schedules = data || [];
    }

    console.log(`[scheduled-reports] Found ${schedules.length} schedules to run`);

    const results = [];

    for (const schedule of schedules) {
      try {
        console.log(`[scheduled-reports] Generating report: ${schedule.name} (${schedule.report_type})`);

        // Generate report based on type
        let reportData;
        
        switch (schedule.report_type) {
          case 'presence':
            reportData = await generatePresenceReport(supabase, schedule.project_id, schedule.filters);
            break;
          case 'access':
            reportData = await generateAccessReport(supabase, schedule.project_id, schedule.filters);
            break;
          case 'compliance':
            reportData = await generateComplianceReport(supabase, schedule.project_id, schedule.filters);
            break;
          case 'device':
            reportData = await generateDeviceReport(supabase, schedule.project_id, schedule.filters);
            break;
          default:
            throw new Error(`Unknown report type: ${schedule.report_type}`);
        }

        // Calculate next run time
        const nextRun = calculateNextRun(schedule.frequency);

        // Update schedule
        await supabase
          .from('report_schedules')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: nextRun.toISOString()
          })
          .eq('id', schedule.id);

        results.push({
          schedule_id: schedule.id,
          name: schedule.name,
          success: true,
          records: reportData.length,
          next_run: nextRun.toISOString()
        });

        console.log(`[scheduled-reports] Report ${schedule.name} generated with ${reportData.length} records`);

      } catch (scheduleError) {
        console.error(`[scheduled-reports] Error processing schedule ${schedule.id}:`, scheduleError);
        results.push({
          schedule_id: schedule.id,
          name: schedule.name,
          success: false,
          error: scheduleError.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        schedulesProcessed: schedules.length,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('[scheduled-reports] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

function calculateNextRun(frequency: string): Date {
  const now = new Date();
  
  switch (frequency) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'monthly':
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return nextMonth;
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

async function generatePresenceReport(supabase: any, projectId: string | null, filters: any) {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
  const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

  let query = supabase
    .from('access_logs')
    .select('*')
    .gte('timestamp', startOfDay)
    .lte('timestamp', endOfDay)
    .order('timestamp', { ascending: false });

  const { data, error } = await query;
  
  if (error) throw error;
  return data || [];
}

async function generateAccessReport(supabase: any, projectId: string | null, filters: any) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('access_logs')
    .select('*')
    .gte('timestamp', thirtyDaysAgo)
    .order('timestamp', { ascending: false })
    .limit(1000);

  const { data, error } = await query;
  
  if (error) throw error;
  return data || [];
}

async function generateComplianceReport(supabase: any, projectId: string | null, filters: any) {
  const { data, error } = await supabase
    .from('worker_documents')
    .select(`
      *,
      workers(name, company_id)
    `)
    .order('expiry_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function generateDeviceReport(supabase: any, projectId: string | null, filters: any) {
  let query = supabase
    .from('devices')
    .select('*')
    .order('name');

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  
  if (error) throw error;
  return data || [];
}
