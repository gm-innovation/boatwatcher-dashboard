import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type AccessDirection = 'entry' | 'exit' | 'unknown'

interface ControlIDNotificationPayload {
  device_id?: string | number
  serial_number?: string
  user_id?: string | number
  direction?: string | number
  time?: string | number
  score?: string | number
  event_type?: string
  event?: string | number
  portal_id?: string | number
  identifier_id?: string | number
  access_photo?: string
  photo?: string
  token?: string
  agent_version?: string
  status?: string
}

const PHOTO_MATCH_WINDOW_MS = 2 * 60 * 1000

function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
}

function parseEventTime(rawTime?: string | number) {
  if (rawTime === undefined || rawTime === null || rawTime === '') {
    return new Date().toISOString()
  }

  const numericTime = Number(rawTime)
  if (!Number.isNaN(numericTime)) {
    const timestamp = numericTime < 9999999999 ? numericTime * 1000 : numericTime
    return new Date(timestamp).toISOString()
  }

  const parsed = new Date(rawTime)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }

  return parsed.toISOString()
}

function mapDirection(direction?: string | number): AccessDirection {
  if (direction === 1 || direction === '1') return 'entry'
  if (direction === 2 || direction === '2') return 'exit'
  if (typeof direction !== 'string') return 'unknown'

  const normalized = direction.toLowerCase()
  if (normalized === 'entry' || normalized === 'in' || normalized === 'entrada') return 'entry'
  if (normalized === 'exit' || normalized === 'out' || normalized === 'saida' || normalized === 'saída') return 'exit'
  return 'unknown'
}

function normalizePhotoData(photo?: string | null) {
  if (!photo) return null

  const normalized = photo.replace(/\s+/g, '').trim()
  if (!normalized) return null
  if (normalized.startsWith('data:image/')) return normalized

  return `data:image/jpeg;base64,${normalized}`
}

function getClientIp(req: Request) {
  return req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
}

async function resolveDevice(supabase: ReturnType<typeof getSupabaseClient>, identifier?: string | number) {
  if (!identifier) return null

  const normalizedIdentifier = identifier.toString()
  const { data, error } = await supabase
    .from('devices')
    .select('id, name, controlid_serial_number, project_id')
    .eq('controlid_serial_number', normalizedIdentifier)
    .maybeSingle()

  if (error) {
    console.error('Error fetching device:', error)
    return null
  }

  return data
}

async function markDeviceOnline(supabase: ReturnType<typeof getSupabaseClient>, deviceId: string) {
  await supabase
    .from('devices')
    .update({ status: 'online', last_event_timestamp: new Date().toISOString() })
    .eq('id', deviceId)
}

async function resolveWorker(supabase: ReturnType<typeof getSupabaseClient>, rawUserId?: string | number) {
  if (rawUserId === undefined || rawUserId === null) return null

  const userId = rawUserId.toString().trim()
  if (!userId || userId === '0' || userId === '00000000-0000-0000-0000-000000000000') {
    return null
  }

  const numericCode = Number.parseInt(userId, 10)
  if (!Number.isNaN(numericCode)) {
    const { data: byCode, error: byCodeError } = await supabase
      .from('workers')
      .select('id, name, document_number')
      .eq('code', numericCode)
      .maybeSingle()

    if (byCodeError) console.error('Error fetching worker by code:', byCodeError)
    if (byCode) return byCode
  }

  const { data: byDocument, error: byDocumentError } = await supabase
    .from('workers')
    .select('id, name, document_number')
    .eq('document_number', userId)
    .maybeSingle()

  if (byDocumentError) console.error('Error fetching worker by document:', byDocumentError)
  if (byDocument) return byDocument

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    const { data: byId, error: byIdError } = await supabase
      .from('workers')
      .select('id, name, document_number')
      .eq('id', userId)
      .maybeSingle()

    if (byIdError) console.error('Error fetching worker by id:', byIdError)
    if (byId) return byId
  }

  return null
}

function buildAccessLogPayload(payload: ControlIDNotificationPayload, options: {
  deviceRecord: Awaited<ReturnType<typeof resolveDevice>>
  workerRecord: Awaited<ReturnType<typeof resolveWorker>>
  eventTime: string
  photoCaptureUrl?: string | null
  reason?: string | null
  accessStatus?: 'granted' | 'denied'
}) {
  return {
    device_id: options.deviceRecord?.id || null,
    device_name: options.deviceRecord?.name || payload.serial_number || payload.device_id?.toString() || null,
    worker_id: options.workerRecord?.id || null,
    worker_name: options.workerRecord?.name || null,
    worker_document: options.workerRecord?.document_number || null,
    access_status: options.accessStatus ?? 'granted',
    direction: mapDirection(payload.direction),
    timestamp: options.eventTime,
    score: payload.score !== undefined && payload.score !== null && payload.score !== '' ? Number(payload.score) : null,
    reason: options.reason ?? payload.event_type ?? (payload.event !== undefined ? `event_${payload.event}` : null),
    photo_capture_url: options.photoCaptureUrl ?? null,
  }
}

async function findMatchingAccessLog(
  supabase: ReturnType<typeof getSupabaseClient>,
  deviceId: string,
  workerId: string | null,
  eventTime: string,
) {
  const center = new Date(eventTime).getTime()
  const start = new Date(center - PHOTO_MATCH_WINDOW_MS).toISOString()
  const end = new Date(center + PHOTO_MATCH_WINDOW_MS).toISOString()

  const { data, error } = await supabase
    .from('access_logs')
    .select('id, worker_id, photo_capture_url, timestamp')
    .eq('device_id', deviceId)
    .gte('timestamp', start)
    .lte('timestamp', end)
    .order('timestamp', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error fetching matching access logs:', error)
    return null
  }

  return (data || []).find((log) => {
    if (log.photo_capture_url) return false
    if (!workerId) return !log.worker_id
    return log.worker_id === workerId
  }) ?? null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = getSupabaseClient()

  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/api\//, '/').replace(/^\/functions\/v1\/api\//, '/')

  console.log(`[API] ${req.method} ${path}`)

  try {
    // ==================== HEARTBEAT ====================
    if (path === '/notifications/device_is_alive' || path.endsWith('/notifications/device_is_alive')) {
      const body: ControlIDNotificationPayload = await req.json().catch(() => ({}))
      console.log('CONTROLID HEARTBEAT:', JSON.stringify(body))

      if (body.event_type === 'agent_heartbeat' && body.token) {
        const clientIp = getClientIp(req)
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
        else console.warn('Agent with provided token not found')
      }

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

      return new Response(JSON.stringify({ status: 'ok', alive: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ==================== ACCESS LOGS (DAO) ====================
    if (path === '/notifications/dao' || path.endsWith('/notifications/dao')) {
      const body: ControlIDNotificationPayload = await req.json().catch(() => ({}))
      console.log('CONTROLID EVENT:', JSON.stringify(body))

      const serialNumber = body.serial_number || body.device_id?.toString()
      const deviceRecord = await resolveDevice(supabase, serialNumber)

      if (deviceRecord) {
        await markDeviceOnline(supabase, deviceRecord.id)
      } else if (serialNumber) {
        console.warn(`Device with serial ${serialNumber} not found`)
      }

      const workerRecord = await resolveWorker(supabase, body.user_id)
      const eventTime = parseEventTime(body.time)
      const photoCaptureUrl = normalizePhotoData(body.access_photo || body.photo)
      const accessLog = buildAccessLogPayload(body, {
        deviceRecord,
        workerRecord,
        eventTime,
        photoCaptureUrl,
      })

      const { error: insertError } = await supabase.from('access_logs').insert(accessLog)
      if (insertError) console.error('Error inserting access_log:', insertError)
      else console.log('Access log inserted:', accessLog.worker_name || 'unknown worker')

      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ==================== ACCESS PHOTOS ====================
    if (path === '/notifications/access_photo' || path.endsWith('/notifications/access_photo')) {
      const body: ControlIDNotificationPayload = await req.json().catch(() => ({}))
      console.log('CONTROLID ACCESS PHOTO:', JSON.stringify({
        ...body,
        access_photo: body.access_photo ? '[base64 omitted]' : undefined,
        photo: body.photo ? '[base64 omitted]' : undefined,
      }))

      const serialNumber = body.serial_number || body.device_id?.toString()
      const photoCaptureUrl = normalizePhotoData(body.access_photo || body.photo)

      if (!photoCaptureUrl) {
        return new Response(JSON.stringify({ error: 'access_photo is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const deviceRecord = await resolveDevice(supabase, serialNumber)
      if (!deviceRecord) {
        return new Response(JSON.stringify({ error: 'Device not found', device_identifier: serialNumber || null }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      await markDeviceOnline(supabase, deviceRecord.id)

      const workerRecord = await resolveWorker(supabase, body.user_id)
      const eventTime = parseEventTime(body.time)
      const matchingLog = await findMatchingAccessLog(supabase, deviceRecord.id, workerRecord?.id || null, eventTime)

      if (matchingLog) {
        const { error: updateError } = await supabase
          .from('access_logs')
          .update({ photo_capture_url: photoCaptureUrl })
          .eq('id', matchingLog.id)

        if (updateError) {
          console.error('Error updating access log photo:', updateError)
          return new Response(JSON.stringify({ error: 'Failed to update access photo' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ status: 'ok', action: 'updated', access_log_id: matchingLog.id }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const accessLog = buildAccessLogPayload(body, {
        deviceRecord,
        workerRecord,
        eventTime,
        photoCaptureUrl,
        reason: 'access_photo',
      })

      const { data: insertedLog, error: insertError } = await supabase
        .from('access_logs')
        .insert(accessLog)
        .select('id')
        .single()

      if (insertError) {
        console.error('Error inserting access photo log:', insertError)
        return new Response(JSON.stringify({ error: 'Failed to create access photo log' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ status: 'ok', action: 'created', access_log_id: insertedLog.id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ==================== DOOR EVENTS ====================
    if (path === '/notifications/door' || path.endsWith('/notifications/door')) {
      const body = await req.json().catch(() => ({}))
      console.log('CONTROLID DOOR EVENT:', JSON.stringify(body))
      return new Response(JSON.stringify({ status: 'ok' }), {
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

      const workersWithPhotos = await Promise.all(
        (workers || []).map(async (worker) => {
          if (worker.photo_url) {
            const photoPath = worker.photo_url.replace(/^worker-photos\//, '')
            const { data: signedData } = await supabase.storage
              .from('worker-photos')
              .createSignedUrl(photoPath, 3600)
            return { ...worker, photo_signed_url: signedData?.signedUrl ?? null }
          }
          return { ...worker, photo_signed_url: null }
        })
      )

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

        if (cmd.command === 'sync_users' && device?.project_id) {
          const { data: syncWorkers } = await supabase
            .from('workers')
            .select('id, name, code, document_number, photo_url, status, company_id, role')
            .eq('status', 'active')
            .contains('allowed_project_ids', [device.project_id])

          const syncWorkersWithPhotos = await Promise.all(
            (syncWorkers || []).map(async (w) => {
              if (w.photo_url) {
                const photoPath = w.photo_url.replace(/^worker-photos\//, '')
                const { data: signedData } = await supabase.storage
                  .from('worker-photos')
                  .createSignedUrl(photoPath, 3600)
                return { ...w, photo_signed_url: signedData?.signedUrl ?? null }
              }
              return { ...w, photo_signed_url: null }
            })
          )

          enriched.payload = { ...((cmd.payload as any) || {}), workers: syncWorkersWithPhotos }
        }

        return enriched
      }))

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

    console.log('UNKNOWN ROUTE:', path)
    return new Response(JSON.stringify({ error: 'not_found', path }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('API Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})