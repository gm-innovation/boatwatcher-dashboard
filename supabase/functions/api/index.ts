import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/api\//, '/').replace(/^\/functions\/v1\/api\//, '/')

  console.log(`[API] ${req.method} ${path}`)

  try {
    // ==================== HEARTBEAT ====================
    if (path === '/notifications/device_is_alive' || path.endsWith('/notifications/device_is_alive')) {
      const body = await req.json().catch(() => ({}))
      console.log("CONTROLID HEARTBEAT:", JSON.stringify(body))

      // Handle agent heartbeat (update local_agents table)
      if (body.event_type === 'agent_heartbeat' && body.token) {
        const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
        const { data: agent, error: agentError } = await supabase
          .from('local_agents')
          .update({ 
            status: 'online', 
            last_seen_at: new Date().toISOString(),
            version: body.agent_version || null,
            ip_address: clientIp
          })
          .eq('token', body.token)
          .select('id, name')
          .maybeSingle()

        if (agentError) console.error('Error updating agent status:', agentError)
        else if (agent) console.log(`Agent ${agent.name} set to online, version: ${body.agent_version}`)
        else console.warn(`Agent with provided token not found`)
      }

      // Handle device heartbeat (update devices table)
      const serialNumber = body.serial_number || body.device_id?.toString()
      if (serialNumber) {
        const { data: device, error } = await supabase
          .from('devices')
          .update({ status: 'online', last_event_timestamp: new Date().toISOString() })
          .eq('controlid_serial_number', serialNumber)
          .select('id, name')
          .maybeSingle()

        if (error) console.error('Error updating device status:', error)
        else if (device) console.log(`Device ${device.name} set to online`)
        else console.warn(`Device with serial ${serialNumber} not found`)
      }

      return new Response(JSON.stringify({ status: "ok", alive: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ==================== ACCESS LOGS (DAO) ====================
    if (path === '/notifications/dao' || path.endsWith('/notifications/dao')) {
      const body = await req.json().catch(() => ({}))
      console.log("CONTROLID EVENT:", JSON.stringify(body))

      const serialNumber = body.serial_number || body.device_id?.toString()
      let deviceRecord: any = null

      if (serialNumber) {
        const { data } = await supabase
          .from('devices')
          .select('id, name')
          .eq('controlid_serial_number', serialNumber)
          .maybeSingle()
        deviceRecord = data

        // Also mark device as online since it's sending events
        if (deviceRecord) {
          await supabase
            .from('devices')
            .update({ status: 'online', last_event_timestamp: new Date().toISOString() })
            .eq('id', deviceRecord.id)
        }
      }

      // Try to resolve worker
      let workerRecord: any = null
      const userId = body.user_id?.toString()
      if (userId && userId !== '0') {
        // Try by code first
        const { data: byCode } = await supabase
          .from('workers')
          .select('id, name, document_number')
          .eq('code', parseInt(userId))
          .maybeSingle()

        if (byCode) {
          workerRecord = byCode
        } else {
          // Try by document_number
          const { data: byDoc } = await supabase
            .from('workers')
            .select('id, name, document_number')
            .eq('document_number', userId)
            .maybeSingle()
          workerRecord = byDoc
        }
      }

      // Determine direction
      let direction: 'entry' | 'exit' | 'unknown' = 'unknown'
      if (body.direction === 'entry' || body.direction === 'in' || body.direction === 1) direction = 'entry'
      else if (body.direction === 'exit' || body.direction === 'out' || body.direction === 2) direction = 'exit'

      // Determine timestamp
      const eventTime = body.time
        ? new Date(typeof body.time === 'number' && body.time < 9999999999 ? body.time * 1000 : body.time).toISOString()
        : new Date().toISOString()

      // Insert access log
      const accessLog = {
        device_id: deviceRecord?.id || null,
        device_name: deviceRecord?.name || serialNumber || null,
        worker_id: workerRecord?.id || null,
        worker_name: workerRecord?.name || null,
        worker_document: workerRecord?.document_number || null,
        access_status: 'granted' as const,
        direction,
        timestamp: eventTime,
        score: body.score ? parseFloat(body.score) : null,
        reason: body.event_type || null,
      }

      const { error: insertError } = await supabase.from('access_logs').insert(accessLog)
      if (insertError) console.error('Error inserting access_log:', insertError)
      else console.log('Access log inserted:', accessLog.worker_name || 'unknown worker')

      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ==================== DOOR EVENTS ====================
    if (path === '/notifications/door' || path.endsWith('/notifications/door')) {
      const body = await req.json().catch(() => ({}))
      console.log("CONTROLID DOOR EVENT:", JSON.stringify(body))
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ==================== DOWNLOAD WORKERS ====================
    if (path === '/notifications/download-workers' || path.endsWith('/notifications/download-workers')) {
      const token = url.searchParams.get('token')
      if (!token) {
        return new Response(JSON.stringify({ error: 'token parameter required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: agent, error: agentError } = await supabase
        .from('local_agents')
        .select('id, project_id, status')
        .eq('token', token)
        .maybeSingle()

      if (agentError || !agent) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Update agent last_seen
      await supabase.from('local_agents').update({ 
        status: 'online', 
        last_seen_at: new Date().toISOString() 
      }).eq('id', agent.id)

      const since = url.searchParams.get('since') || '1970-01-01T00:00:00Z'

      let query = supabase
        .from('workers')
        .select('id, name, code, document_number, photo_url, status, company_id, role, allowed_project_ids')
        .eq('status', 'active')
        .gte('updated_at', since)

      if (agent.project_id) {
        query = query.contains('allowed_project_ids', [agent.project_id])
      }

      const { data: workers, error: workersError } = await query

      if (workersError) {
        console.error('Error fetching workers:', workersError)
        return new Response(JSON.stringify({ error: 'Failed to fetch workers' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log(`[download-workers] Agent ${agent.id}: returning ${(workers || []).length} workers since ${since}`)

      // Generate signed URLs for private worker photos
      const workersWithPhotos = await Promise.all(
        (workers || []).map(async (worker) => {
          if (worker.photo_url) {
            const photoPath = worker.photo_url.replace(/^worker-photos\//, '');
            const { data: signedData } = await supabase.storage
              .from('worker-photos')
              .createSignedUrl(photoPath, 3600);
            return { ...worker, photo_signed_url: signedData?.signedUrl ?? null };
          }
          return { ...worker, photo_signed_url: null };
        })
      );

      return new Response(JSON.stringify({ 
        workers: workersWithPhotos, 
        timestamp: new Date().toISOString(),
        count: workersWithPhotos.length 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ==================== POLL COMMANDS ====================
    if (path === '/notifications/poll' || path.endsWith('/notifications/poll')) {
      const deviceIds = url.searchParams.get('device_ids')
      if (!deviceIds) {
        return new Response(JSON.stringify({ error: 'device_ids parameter required', commands: [] }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const serials = deviceIds.split(',').map(s => s.trim())
      
      // Find devices by serial numbers
      const { data: devices } = await supabase
        .from('devices')
        .select('id, name, controlid_serial_number, controlid_ip_address, api_credentials, agent_id, project_id')
        .in('controlid_serial_number', serials)

      if (!devices || devices.length === 0) {
        return new Response(JSON.stringify({ commands: [], message: 'No devices found for given serials' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const deviceUuids = devices.map(d => d.id)

      // Get pending commands
      const { data: commands, error: cmdError } = await supabase
        .from('agent_commands')
        .select('id, device_id, command, payload, created_at')
        .in('device_id', deviceUuids)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(20)

      if (cmdError) {
        console.error('Error fetching commands:', cmdError)
        return new Response(JSON.stringify({ error: 'Failed to fetch commands', commands: [] }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Enrich commands with device info + worker data for sync_users
      const enrichedCommands = await Promise.all((commands || []).map(async (cmd) => {
        const device = devices.find(d => d.id === cmd.device_id)
        const enriched: any = {
          ...cmd,
          device: device ? {
            id: device.id,
            name: device.name,
            ip_address: device.controlid_ip_address,
            serial_number: device.controlid_serial_number,
            api_credentials: device.api_credentials,
          } : null,
        }

        // Enrich sync_users commands with worker data
        if (cmd.command === 'sync_users' && device?.project_id) {
          const { data: syncWorkers } = await supabase
            .from('workers')
            .select('id, name, code, document_number, photo_url, status, company_id, role')
            .eq('status', 'active')
            .contains('allowed_project_ids', [device.project_id])

          const syncWorkersWithPhotos = await Promise.all(
            (syncWorkers || []).map(async (w) => {
              if (w.photo_url) {
                const photoPath = w.photo_url.replace(/^worker-photos\//, '');
                const { data: signedData } = await supabase.storage
                  .from('worker-photos')
                  .createSignedUrl(photoPath, 3600);
                return { ...w, photo_signed_url: signedData?.signedUrl ?? null };
              }
              return { ...w, photo_signed_url: null };
            })
          );

          enriched.payload = { ...((cmd.payload as any) || {}), workers: syncWorkersWithPhotos }
        }

        return enriched
      }))

      // Mark as in_progress
      if (enrichedCommands.length > 0) {
        const ids = enrichedCommands.map(c => c.id)
        await supabase
          .from('agent_commands')
          .update({ status: 'in_progress' })
          .in('id', ids)
      }

      return new Response(JSON.stringify({ commands: enrichedCommands, timestamp: new Date().toISOString() }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ==================== UNKNOWN ROUTE ====================
    console.log("UNKNOWN ROUTE:", path)
    return new Response(JSON.stringify({ error: "not_found", path }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error("API Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
