import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ControlIDEvent {
  device_id?: string
  serial_number?: string
  user_id?: string
  time?: number
  event_type?: string
  direction?: string
  score?: number
  photo?: string
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
    const authHeader = req.headers.get('authorization') || req.headers.get('x-api-key')
    const url = new URL(req.url)
    const tokenFromQuery = url.searchParams.get('token')
    const token = authHeader?.replace('Bearer ', '') || tokenFromQuery

    const event: ControlIDEvent = await req.json()
    console.log('ControlID Webhook Event:', JSON.stringify(event, null, 2))

    // Buscar dispositivo pelo serial number
    const deviceIdentifier = event.serial_number || event.device_id
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, name, project_id, configuration')
      .eq('controlid_serial_number', deviceIdentifier)
      .single()

    if (deviceError || !device) {
      console.error('Device not found:', deviceIdentifier)
      return new Response(
        JSON.stringify({ access: false, reason: 'device_not_registered', message: 'Dispositivo não cadastrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate token if provided
    if (token) {
      const { data: tokenData, error: tokenError } = await supabase
        .from('device_api_tokens')
        .select('id, device_id, is_active, expires_at')
        .eq('token', token)
        .single()

      if (tokenError || !tokenData || !tokenData.is_active) {
        return new Response(
          JSON.stringify({ access: false, reason: 'invalid_token', message: 'Token inválido' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ access: false, reason: 'token_expired', message: 'Token expirado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (tokenData.device_id !== device.id) {
        return new Response(
          JSON.stringify({ access: false, reason: 'token_device_mismatch', message: 'Token não pertence a este dispositivo' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await supabase.from('device_api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tokenData.id)
    }

    // Update device status
    await supabase.from('devices').update({ last_event_timestamp: new Date().toISOString(), status: 'online' }).eq('id', device.id)

    // Resolve direction for unrecognized attempts too
    const unrecognizedDirection = event.direction
      ? mapDirection(event.direction)
      : ((device.configuration as any)?.passage_direction || 'unknown')

    // Unrecognized attempt
    if (!event.user_id) {
      const unrecTimestamp = new Date(event.time ? event.time * 1000 + 3 * 3600 * 1000 : Date.now()).toISOString()
      const { error: unrecErr } = await supabase.from('access_logs').insert({
        device_id: device.id, device_name: device.name,
        timestamp: unrecTimestamp,
        access_status: 'denied', reason: 'not_recognized',
        direction: unrecognizedDirection, score: event.score,
        photo_capture_url: event.photo || null
      })

      if (unrecErr && unrecErr.code !== '23505') {
        console.error('Error inserting unrecognized access log:', unrecErr)
      }

      // Phase 5: Notify admins of unrecognized access attempt
      await createAccessDeniedNotification(supabase, device, 'not_recognized', 'Tentativa de acesso não reconhecida')

      return new Response(
        JSON.stringify({ access: false, reason: 'not_recognized', message: 'Não Reconhecido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up worker — ControlID sends integer `code`, not UUID
    const userIdStr = String(event.user_id)
    const isUuid = /^[0-9a-f]{8}-/.test(userIdStr)
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('id, name, status, document_number, allowed_project_ids')
      .eq(isUuid ? 'id' : 'code', isUuid ? event.user_id : Number(event.user_id))
      .single()

    let accessGranted = false
    let reason = 'unknown'
    let workerName = null
    let workerDocument = null

    if (workerError || !worker) {
      reason = 'worker_not_found'
    } else {
      workerName = worker.name
      workerDocument = worker.document_number

      if (worker.status === 'blocked') {
        reason = 'worker_blocked'
      } else if (worker.status === 'inactive') {
        reason = 'worker_inactive'
      } else if (worker.status === 'pending_review') {
        reason = 'worker_pending_review'
      } else {
        const allowedProjects = worker.allowed_project_ids || []
        if (device.project_id && !allowedProjects.includes(device.project_id)) {
          reason = 'not_authorized_for_project'
        } else {
          accessGranted = true
          reason = 'recognized_and_authorized'
        }
      }
    }

    // Resolve direction: prefer event payload, fallback to device config
    const resolvedDirection = event.direction
      ? mapDirection(event.direction)
      : ((device.configuration as any)?.passage_direction || 'unknown')

    // Insert access log (with deduplication via unique constraint)
    const eventTimestamp = new Date(event.time ? event.time * 1000 + 3 * 3600 * 1000 : Date.now()).toISOString()
    const { error: logInsertError } = await supabase.from('access_logs').insert({
      worker_id: worker?.id || null, worker_name: workerName, worker_document: workerDocument,
      device_id: device.id, device_name: device.name,
      timestamp: eventTimestamp,
      access_status: accessGranted ? 'granted' : 'denied', reason,
      direction: resolvedDirection, score: event.score,
      photo_capture_url: event.photo || null
    })

    if (logInsertError) {
      if (logInsertError.code === '23505') {
        console.log('Webhook access log deduplicated via unique constraint')
      } else {
        console.error('Error inserting webhook access_log:', logInsertError)
      }
    }

    // Phase 5: Notify on access denied
    if (!accessGranted) {
      await createAccessDeniedNotification(
        supabase, device, reason,
        workerName ? `Acesso negado para ${workerName}: ${getAccessDeniedMessage(reason)}` : `Acesso negado: ${getAccessDeniedMessage(reason)}`
      )
    }

    return new Response(
      JSON.stringify({ access: accessGranted, reason, message: accessGranted ? 'Acesso Liberado' : getAccessDeniedMessage(reason) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Webhook Error:', error)
    return new Response(
      JSON.stringify({ access: false, reason: 'system_error', message: 'Erro do Sistema', error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function createAccessDeniedNotification(supabase: any, device: any, reason: string, message: string) {
  try {
    const { data: adminUsers } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')

    if (!adminUsers || adminUsers.length === 0) return

    const notifications = adminUsers.map((u: any) => ({
      user_id: u.user_id,
      type: 'access_denied',
      title: `Acesso Negado - ${device.name}`,
      message,
      priority: reason === 'worker_blocked' ? 'critical' : 'high',
      related_entity_type: 'device',
      related_entity_id: device.id,
    }))

    await supabase.from('notifications').insert(notifications)
  } catch (e) {
    console.error('Error creating access denied notification:', e)
  }
}

function mapDirection(direction?: string): 'entry' | 'exit' | 'unknown' {
  if (!direction) return 'unknown'
  const d = direction.toLowerCase()
  if (d === 'in' || d === 'entry' || d === 'entrada') return 'entry'
  if (d === 'out' || d === 'exit' || d === 'saida' || d === 'saída') return 'exit'
  return 'unknown'
}

function getAccessDeniedMessage(reason: string): string {
  const messages: Record<string, string> = {
    'not_recognized': 'Não Reconhecido',
    'worker_not_found': 'Colaborador Não Cadastrado',
    'worker_blocked': 'Acesso Bloqueado',
    'worker_inactive': 'Colaborador Inativo',
    'worker_pending_review': 'Pendente de Revisão',
    'not_authorized_for_project': 'Sem Permissão',
    'device_not_registered': 'Dispositivo Não Cadastrado',
    'system_error': 'Erro do Sistema'
  }
  return messages[reason] || 'Acesso Negado'
}
