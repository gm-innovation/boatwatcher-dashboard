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
    const event: ControlIDEvent = await req.json()
    console.log('ControlID Webhook Event:', JSON.stringify(event, null, 2))

    // Buscar dispositivo pelo serial number
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, name, project_id')
      .eq('controlid_serial_number', event.serial_number || event.device_id)
      .single()

    if (deviceError || !device) {
      console.error('Device not found:', event.serial_number || event.device_id)
      return new Response(
        JSON.stringify({ 
          access: false, 
          reason: 'device_not_registered' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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

      return new Response(
        JSON.stringify({ 
          access: false, 
          reason: 'not_recognized' 
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

    console.log('Access decision:', { accessGranted, reason, workerId: worker?.id })

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
