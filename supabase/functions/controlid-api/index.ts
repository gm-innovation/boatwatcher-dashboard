import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface DeviceCredentials {
  ip: string
  username?: string
  password?: string
  port?: number
}

interface ControlIDResponse {
  success: boolean
  data?: any
  error?: string
}

// Função para fazer requisições à API do dispositivo ControlID
async function controlIDRequest(
  device: DeviceCredentials,
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<ControlIDResponse> {
  const baseUrl = `http://${device.ip}:${device.port || 80}`
  const url = `${baseUrl}${endpoint}`
  
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Autenticação básica se credenciais fornecidas
    if (device.username && device.password) {
      const auth = btoa(`${device.username}:${device.password}`)
      headers['Authorization'] = `Basic ${auth}`
    }

    console.log(`ControlID Request: ${method} ${url}`)

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    const text = await response.text()
    console.log(`ControlID Response (${response.status}):`, text)

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${text}`
      }
    }

    try {
      const data = JSON.parse(text)
      return { success: true, data }
    } catch {
      return { success: true, data: text }
    }
  } catch (error) {
    console.error('ControlID Request Error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Obter informações do dispositivo
async function getDeviceInfo(device: DeviceCredentials): Promise<ControlIDResponse> {
  return await controlIDRequest(device, '/device_info.fcgi', 'GET')
}

// Listar usuários cadastrados no dispositivo
async function listUsers(device: DeviceCredentials): Promise<ControlIDResponse> {
  return await controlIDRequest(device, '/users.fcgi', 'POST', {
    object: 'users'
  })
}

// Cadastrar usuário no dispositivo
async function enrollUser(
  device: DeviceCredentials,
  userId: string,
  userName: string,
  userPhoto?: string
): Promise<ControlIDResponse> {
  const userData: any = {
    object: 'users',
    values: [{
      id: userId,
      name: userName,
      registration: userId,
    }]
  }

  // Primeiro cadastra o usuário
  const userResult = await controlIDRequest(device, '/users.fcgi', 'POST', userData)
  
  if (!userResult.success) {
    return userResult
  }

  // Se tiver foto, cadastra a biometria facial
  if (userPhoto) {
    const photoData = {
      object: 'user_images',
      values: [{
        user_id: userId,
        image: userPhoto, // Base64 encoded image
        timestamp: Date.now()
      }]
    }

    const photoResult = await controlIDRequest(device, '/user_images.fcgi', 'POST', photoData)
    if (!photoResult.success) {
      console.warn('Failed to enroll photo, but user was created:', photoResult.error)
    }
  }

  return { success: true, data: { message: 'User enrolled successfully' } }
}

// Remover usuário do dispositivo
async function removeUser(device: DeviceCredentials, userId: string): Promise<ControlIDResponse> {
  return await controlIDRequest(device, '/users.fcgi', 'POST', {
    object: 'users',
    where: { users: { id: userId } }
  })
}

// Liberar catraca/porta manualmente
async function releaseAccess(device: DeviceCredentials, doorId: number = 1): Promise<ControlIDResponse> {
  return await controlIDRequest(device, '/execute_actions.fcgi', 'POST', {
    actions: [{
      action: 'door',
      parameters: `door=${doorId}`
    }]
  })
}

// Obter status do dispositivo
async function getDeviceStatus(device: DeviceCredentials): Promise<ControlIDResponse> {
  const info = await getDeviceInfo(device)
  if (!info.success) {
    return { success: false, error: 'Device offline or unreachable' }
  }
  return { success: true, data: { status: 'online', info: info.data } }
}

// Configurar dispositivo
async function configureDevice(
  device: DeviceCredentials,
  config: Record<string, any>
): Promise<ControlIDResponse> {
  return await controlIDRequest(device, '/set_configuration.fcgi', 'POST', config)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, deviceId, ...params } = await req.json()
    console.log('ControlID API Request:', { action, deviceId, params })

    // Buscar credenciais do dispositivo no banco
    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .single()

    if (deviceError || !deviceData) {
      throw new Error(`Device not found: ${deviceId}`)
    }

    const device: DeviceCredentials = {
      ip: deviceData.controlid_ip_address,
      username: deviceData.api_credentials?.username,
      password: deviceData.api_credentials?.password,
      port: deviceData.api_credentials?.port || 80
    }

    let result: ControlIDResponse

    switch (action) {
      case 'getDeviceInfo':
        result = await getDeviceInfo(device)
        break

      case 'getDeviceStatus':
        result = await getDeviceStatus(device)
        // Atualizar status no banco
        if (result.success) {
          await supabase
            .from('devices')
            .update({ 
              status: 'online',
              last_event_timestamp: new Date().toISOString()
            })
            .eq('id', deviceId)
        } else {
          await supabase
            .from('devices')
            .update({ status: 'offline' })
            .eq('id', deviceId)
        }
        break

      case 'listUsers':
        result = await listUsers(device)
        break

      case 'enrollUser':
        result = await enrollUser(
          device,
          params.userId,
          params.userName,
          params.userPhoto
        )
        break

      case 'removeUser':
        result = await removeUser(device, params.userId)
        break

      case 'releaseAccess':
        result = await releaseAccess(device, params.doorId)
        break

      case 'configureDevice':
        result = await configureDevice(device, params.config)
        break

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('ControlID API Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
