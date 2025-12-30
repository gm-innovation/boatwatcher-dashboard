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
    // Extrair token de autenticação
    const authHeader = req.headers.get('authorization') || req.headers.get('x-api-key')
    const url = new URL(req.url)
    const tokenFromQuery = url.searchParams.get('token')
    const token = authHeader?.replace('Bearer ', '') || tokenFromQuery

    console.log('Webhook request received:', {
      hasToken: !!token,
      method: req.method,
      url: req.url
    })

    const event: ControlIDEvent = await req.json()
    console.log('ControlID Webhook Event:', JSON.stringify(event, null, 2))

    // Buscar dispositivo pelo serial number
    const deviceIdentifier = event.serial_number || event.device_id
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, name, project_id')
      .eq('controlid_serial_number', deviceIdentifier)
      .single()

    if (deviceError || !device) {
      console.error('Device not found:', deviceIdentifier)
      return new Response(
        JSON.stringify({ 
          access: false, 
          reason: 'device_not_registered',
          message: 'Dispositivo não cadastrado'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar token de autenticação (se token fornecido)
    if (token) {
      const { data: tokenData, error: tokenError } = await supabase
        .from('device_api_tokens')
        .select('id, device_id, is_active, expires_at')
        .eq('token', token)
        .single()

      if (tokenError || !tokenData) {
        console.warn('Invalid token provided for device:', device.id)
        return new Response(
          JSON.stringify({ 
            access: false, 
            reason: 'invalid_token',
            message: 'Token inválido'
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!tokenData.is_active) {
        console.warn('Token is inactive:', tokenData.id)
        return new Response(
          JSON.stringify({ 
            access: false, 
            reason: 'token_inactive',
            message: 'Token inativo'
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        console.warn('Token expired:', tokenData.id)
        return new Response(
          JSON.stringify({ 
            access: false, 
            reason: 'token_expired',
            message: 'Token expirado'
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (tokenData.device_id !== device.id) {
        console.warn('Token does not match device:', { tokenDeviceId: tokenData.device_id, deviceId: device.id })
        return new Response(
          JSON.stringify({ 
            access: false, 
            reason: 'token_device_mismatch',
            message: 'Token não pertence a este dispositivo'
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Atualizar último uso do token
      await supabase
        .from('device_api_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', tokenData.id)

      console.log('Token validated successfully for device:', device.id)
    } else {
      console.log('No token provided, proceeding without authentication (device:', device.id, ')')
    }

    // Atualizar timestamp do último evento do dispositivo
    await supabase
      .from('devices')
      .update({ 
        last_event_timestamp: new Date().toISOString(),
        status: 'online'
      })
      .eq('id', device.id)

    // Se não tem user_id, é uma tentativa não reconhecida
    if (!event.user_id) {
      // Registrar log de acesso negado
      await supabase
        .from('access_logs')
        .insert({
          device_id: device.id,
          device_name: device.name,
          timestamp: new Date(event.time ? event.time * 1000 : Date.now()).toISOString(),
          access_status: 'denied',
          reason: 'not_recognized',
          direction: mapDirection(event.direction),
          score: event.score,
          photo_capture_url: event.photo || null
        })

      console.log('Access denied: not recognized')
      return new Response(
        JSON.stringify({ 
          access: false, 
          reason: 'not_recognized',
          message: 'Não Reconhecido'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar trabalhador pelo ID
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('id, name, status, document_number, allowed_project_ids')
      .eq('id', event.user_id)
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

      // Verificar status do trabalhador
      if (worker.status === 'blocked') {
        reason = 'worker_blocked'
      } else if (worker.status === 'inactive') {
        reason = 'worker_inactive'
      } else if (worker.status === 'pending_review') {
        reason = 'worker_pending_review'
      } else {
        // Verificar se tem permissão para o projeto
        const allowedProjects = worker.allowed_project_ids || []
        
        if (device.project_id && !allowedProjects.includes(device.project_id)) {
          reason = 'not_authorized_for_project'
        } else {
          accessGranted = true
          reason = 'recognized_and_authorized'
        }
      }
    }

    // Registrar log de acesso
    await supabase
      .from('access_logs')
      .insert({
        worker_id: worker?.id || null,
        worker_name: workerName,
        worker_document: workerDocument,
        device_id: device.id,
        device_name: device.name,
        timestamp: new Date(event.time ? event.time * 1000 : Date.now()).toISOString(),
        access_status: accessGranted ? 'granted' : 'denied',
        reason,
        direction: mapDirection(event.direction),
        score: event.score,
        photo_capture_url: event.photo || null
      })

    console.log('Access decision:', { accessGranted, reason, workerId: worker?.id, deviceId: device.id })

    // Retornar decisão para o dispositivo
    return new Response(
      JSON.stringify({ 
        access: accessGranted, 
        reason,
        message: accessGranted ? 'Acesso Liberado' : getAccessDeniedMessage(reason)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook Error:', error)
    return new Response(
      JSON.stringify({ 
        access: false, 
        reason: 'system_error',
        message: 'Erro do Sistema',
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

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