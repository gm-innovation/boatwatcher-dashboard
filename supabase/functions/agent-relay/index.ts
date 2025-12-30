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
    // Extrair token de autenticação do agente
    const authHeader = req.headers.get('authorization') || req.headers.get('x-agent-token')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      console.log('No agent token provided')
      return new Response(
        JSON.stringify({ error: 'Agent token required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar agente pelo token
    const { data: agent, error: agentError } = await supabase
      .from('local_agents')
      .select('id, name, project_id, status')
      .eq('token', token)
      .maybeSingle()

    if (agentError || !agent) {
      console.log('Invalid agent token:', token.substring(0, 8) + '...')
      return new Response(
        JSON.stringify({ error: 'Invalid agent token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Atualizar status do agente
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
    const agentVersion = req.headers.get('x-agent-version') || 'unknown'
    
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

    console.log('Agent relay action:', action, 'from agent:', agent.name)

    // Rota: GET /poll - Buscar comandos pendentes
    if (req.method === 'GET' || action === 'poll') {
      const { data: commands, error: cmdError } = await supabase
        .from('agent_commands')
        .select(`
          id,
          device_id,
          command,
          payload,
          created_at,
          devices!inner (
            id,
            name,
            controlid_ip_address,
            controlid_serial_number,
            api_credentials
          )
        `)
        .eq('agent_id', agent.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10)

      if (cmdError) {
        console.error('Error fetching commands:', cmdError)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch commands' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Marcar comandos como "in_progress"
      if (commands && commands.length > 0) {
        const commandIds = commands.map(c => c.id)
        await supabase
          .from('agent_commands')
          .update({ status: 'in_progress' })
          .in('id', commandIds)
      }

      return new Response(
        JSON.stringify({ 
          agent_id: agent.id,
          agent_name: agent.name,
          commands: commands || [],
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rota: POST /result - Receber resultado de comando
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

        console.log('Command result saved:', result.command_id, result.success ? 'success' : 'failed')
      }

      return new Response(
        JSON.stringify({ success: true, processed: results.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rota: POST /heartbeat - Apenas atualizar status
    if (req.method === 'POST' && action === 'heartbeat') {
      const body = await req.json().catch(() => ({}))
      
      // Atualizar dispositivos associados ao agente
      if (body.devices && Array.isArray(body.devices)) {
        for (const deviceStatus of body.devices) {
          await supabase
            .from('devices')
            .update({ 
              status: deviceStatus.online ? 'online' : 'offline',
              last_event_timestamp: new Date().toISOString()
            })
            .eq('controlid_serial_number', deviceStatus.serial_number)
            .eq('agent_id', agent.id)
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          agent_id: agent.id,
          timestamp: new Date().toISOString()
        }),
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