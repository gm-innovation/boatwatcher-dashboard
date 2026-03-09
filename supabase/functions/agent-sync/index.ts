import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-token',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const token = (req.headers.get('x-agent-token') || req.headers.get('authorization'))?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: agent } = await supabase.from('local_agents').select('id, project_id, status').eq('token', token).maybeSingle()
    if (!agent) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const url = new URL(req.url)
    const action = url.pathname.split('/').pop() || ''

    // POST /upload-logs
    if (req.method === 'POST' && action === 'upload-logs') {
      const { logs } = await req.json()
      if (!Array.isArray(logs) || logs.length === 0) {
        return new Response(JSON.stringify({ error: 'Empty logs' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { error } = await supabase.from('access_logs').insert(logs)
      if (error) throw error

      await supabase.from('local_agents').update({ last_sync_at: new Date().toISOString(), pending_sync_count: 0, sync_status: 'synced' }).eq('id', agent.id)

      return new Response(JSON.stringify({ success: true, count: logs.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /download-workers
    if (req.method === 'GET' && action === 'download-workers') {
      const since = url.searchParams.get('since') || '1970-01-01T00:00:00Z'
      const { data: workers, error } = await supabase
        .from('workers')
        .select('id, name, code, document_number, photo_url, status')
        .contains('allowed_project_ids', [agent.project_id])
        .gte('updated_at', since)
        .eq('status', 'active')

      if (error) throw error
      return new Response(JSON.stringify({ workers: workers || [], timestamp: new Date().toISOString() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST /status (heartbeat)
    if (req.method === 'POST' && action === 'status') {
      const body = await req.json().catch(() => ({}))
      await supabase.from('local_agents').update({
        status: 'online',
        last_seen_at: new Date().toISOString(),
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        version: body.version || null,
        sync_status: body.sync_status || 'idle',
        pending_sync_count: body.pending_count ?? 0,
      }).eq('id', agent.id)

      return new Response(JSON.stringify({ success: true, agent_id: agent.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('agent-sync error:', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
