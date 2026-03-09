import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface CommandResult {
  command_id: string
  success: boolean
  result?: unknown
  error?: string
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
    const authHeader = req.headers.get('authorization') || req.headers.get('x-agent-token')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Agent token required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: agent, error: agentError } = await supabase
      .from('local_agents')
      .select('id, name, project_id, status')
      .eq('token', token)
      .maybeSingle()

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: 'Invalid agent token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update agent status
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
    const agentVersion = req.headers.get('x-agent-version') || 'unknown'
    
    const previousStatus = agent.status

    await supabase
      .from('local_agents')
      .update({ 
        status: 'online',
        last_seen_at: new Date().toISOString(),
        ip_address: clientIp,
        version: agentVersion
      })
      .eq('id', agent.id)

    const url = new URL(req.url)
    const action = url.pathname.split('/').pop() || 'poll'

    // GET /poll - Fetch pending commands
    if (req.method === 'GET' || action === 'poll') {
      const { data: commands, error: cmdError } = await supabase
        .from('agent_commands')
        .select(`
          id, device_id, command, payload, created_at,
          devices!inner (
            id, name, controlid_ip_address, controlid_serial_number, api_credentials
          )
        `)
        .eq('agent_id', agent.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10)

      if (cmdError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch commands' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // For sync_users command, enrich with worker data
      const enrichedCommands = []
      for (const cmd of (commands || [])) {
        if (cmd.command === 'sync_users' || cmd.command === 'enroll_user') {
          // Fetch workers for the project
          const projectId = agent.project_id
          if (projectId && cmd.command === 'sync_users') {
            const { data: workers } = await supabase
              .from('workers')
              .select('id, name, code, document_number, photo_url, status')
              .contains('allowed_project_ids', [projectId])
              .eq('status', 'active')

            cmd.payload = { ...cmd.payload, workers: workers || [] }
          }
          
          if (cmd.command === 'enroll_user' && cmd.payload?.worker_id) {
            const { data: worker } = await supabase
              .from('workers')
              .select('id, name, code, document_number, photo_url')
              .eq('id', cmd.payload.worker_id)
              .single()

            if (worker) {
              cmd.payload = { ...cmd.payload, worker }
            }
          }
        }
        enrichedCommands.push(cmd)
      }

      // Mark as in_progress
      if (enrichedCommands.length > 0) {
        const commandIds = enrichedCommands.map(c => c.id)
        await supabase.from('agent_commands').update({ status: 'in_progress' }).in('id', commandIds)
      }

      return new Response(
        JSON.stringify({ 
          agent_id: agent.id, agent_name: agent.name,
          commands: enrichedCommands, timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /result - Receive command results
    if (req.method === 'POST' && action === 'result') {
      const results: CommandResult[] = await req.json()

      if (!Array.isArray(results)) {
        return new Response(
          JSON.stringify({ error: 'Expected array of results' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      for (const result of results) {
        await supabase
          .from('agent_commands')
          .update({
            status: result.success ? 'completed' : 'failed',
            result: result.result || null,
            error_message: result.error || null,
            executed_at: new Date().toISOString()
          })
          .eq('id', result.command_id)
          .eq('agent_id', agent.id)
      }

      return new Response(
        JSON.stringify({ success: true, processed: results.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /heartbeat - Update status + device status + offline notifications
    if (req.method === 'POST' && action === 'heartbeat') {
      const body = await req.json().catch(() => ({}))
      
      if (body.devices && Array.isArray(body.devices)) {
        for (const deviceStatus of body.devices) {
          // Get current device status before updating
          const { data: currentDevice } = await supabase
            .from('devices')
            .select('id, name, status')
            .eq('controlid_serial_number', deviceStatus.serial_number)
            .eq('agent_id', agent.id)
            .maybeSingle()

          const newStatus = deviceStatus.online ? 'online' : 'offline'

          await supabase
            .from('devices')
            .update({ status: newStatus, last_event_timestamp: new Date().toISOString() })
            .eq('controlid_serial_number', deviceStatus.serial_number)
            .eq('agent_id', agent.id)

          // Phase 5: Notify if device went offline
          if (currentDevice && currentDevice.status === 'online' && !deviceStatus.online) {
            await createDeviceOfflineNotification(supabase, currentDevice)
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, agent_id: agent.id, timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Agent relay error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function createDeviceOfflineNotification(supabase: any, device: any) {
  try {
    const { data: adminUsers } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')

    if (!adminUsers || adminUsers.length === 0) return

    const notifications = adminUsers.map((u: any) => ({
      user_id: u.user_id,
      type: 'device_offline',
      title: `Dispositivo Offline: ${device.name}`,
      message: `O dispositivo ${device.name} ficou offline.`,
      priority: 'high',
      related_entity_type: 'device',
      related_entity_id: device.id,
    }))

    await supabase.from('notifications').insert(notifications)
  } catch (e) {
    console.error('Error creating device offline notification:', e)
  }
}
