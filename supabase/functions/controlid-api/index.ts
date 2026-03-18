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

function buildUrl(device: DeviceCredentials, endpoint: string, queryParams = ''): string {
  const qs = queryParams ? `?${queryParams}` : ''
  return `http://${device.ip}:${device.port || 80}/${endpoint}${qs}`
}

function buildAuthHeaders(device: DeviceCredentials): Record<string, string> {
  const headers: Record<string, string> = {}
  if (device.username && device.password) {
    headers['Authorization'] = `Basic ${btoa(`${device.username}:${device.password}`)}`
  }
  return headers
}

async function controlIDRequest(
  device: DeviceCredentials,
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<ControlIDResponse> {
  const url = buildUrl(device, endpoint)

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(device),
    }

    console.log(`ControlID Request: ${method} ${url}`)

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    const text = await response.text()
    console.log(`ControlID Response (${response.status}):`, text.substring(0, 500))

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${text}` }
    }

    try {
      const data = JSON.parse(text)
      return { success: true, data }
    } catch {
      return { success: true, data: text }
    }
  } catch (error) {
    console.error('ControlID Request Error:', error)
    return { success: false, error: error.message }
  }
}

async function controlIDRequestBinary(
  device: DeviceCredentials,
  endpoint: string,
  queryParams: string,
  imageData: Uint8Array
): Promise<ControlIDResponse> {
  const url = buildUrl(device, endpoint, queryParams)

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
      ...buildAuthHeaders(device),
    }

    console.log(`ControlID Binary Request: POST ${url} (${imageData.byteLength} bytes)`)

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: imageData,
    })

    const text = await response.text()
    console.log(`ControlID Binary Response (${response.status}):`, text.substring(0, 500))

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${text}` }
    }

    try {
      const data = JSON.parse(text)
      return { success: true, data }
    } catch {
      return { success: true, data: text }
    }
  } catch (error) {
    console.error('ControlID Binary Request Error:', error)
    return { success: false, error: error.message }
  }
}

async function getDeviceInfo(device: DeviceCredentials): Promise<ControlIDResponse> {
  return await controlIDRequest(device, 'device_info.fcgi', 'GET')
}

async function listUsers(device: DeviceCredentials): Promise<ControlIDResponse> {
  return await controlIDRequest(device, 'users.fcgi', 'POST', { object: 'users' })
}

async function enrollUser(
  device: DeviceCredentials,
  userId: number,
  userName: string,
  registration: string,
  userPhoto?: string
): Promise<ControlIDResponse> {
  // Step 1: Create user via /create_objects.fcgi
  const userResult = await controlIDRequest(device, 'create_objects.fcgi', 'POST', {
    object: 'users',
    values: [{
      id: userId,
      name: userName,
      registration: registration,
    }]
  })

  if (!userResult.success) {
    return userResult
  }

  // Step 2: Send photo via /user_set_image.fcgi (binary)
  if (userPhoto) {
    try {
      const binaryString = atob(userPhoto)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const timestamp = Math.floor(Date.now() / 1000)
      const queryParams = `user_id=${userId}&timestamp=${timestamp}&match=0`

      const photoResult = await controlIDRequestBinary(device, 'user_set_image.fcgi', queryParams, bytes)
      if (!photoResult.success) {
        console.warn('Failed to enroll photo, but user was created:', photoResult.error)
      } else if (photoResult.data?.success === false) {
        const errors = (photoResult.data.errors || []).map((e: any) => e.message).join('; ')
        console.warn('Photo rejected by device:', errors)
      }
    } catch (photoErr) {
      console.warn('Photo enrollment error:', photoErr.message)
    }
  }

  return { success: true, data: { message: 'User enrolled successfully' } }
}

async function removeUser(device: DeviceCredentials, userId: number): Promise<ControlIDResponse> {
  // Step 1: Remove photo via /user_destroy_image.fcgi
  try {
    await controlIDRequest(device, 'user_destroy_image.fcgi', 'POST', { user_id: userId })
  } catch (err) {
    console.warn('Failed to remove photo:', err.message)
  }

  // Step 2: Remove user via /destroy_objects.fcgi
  return await controlIDRequest(device, 'destroy_objects.fcgi', 'POST', {
    object: 'users',
    where: { users: { id: userId } }
  })
}

async function releaseAccess(device: DeviceCredentials, doorId: number = 1): Promise<ControlIDResponse> {
  return await controlIDRequest(device, 'execute_actions.fcgi', 'POST', {
    actions: [{
      action: 'door',
      parameters: `door=${doorId}`
    }]
  })
}

async function getDeviceStatus(device: DeviceCredentials): Promise<ControlIDResponse> {
  const info = await getDeviceInfo(device)
  if (!info.success) {
    return { success: false, error: 'Device offline or unreachable' }
  }
  return { success: true, data: { status: 'online', info: info.data } }
}

async function configureDevice(
  device: DeviceCredentials,
  config: Record<string, any>
): Promise<ControlIDResponse> {
  return await controlIDRequest(device, 'set_configuration.fcgi', 'POST', config)
}

async function getConfiguration(
  device: DeviceCredentials,
  config: Record<string, any> = { monitor: ['enable_photo_upload'] }
): Promise<ControlIDResponse> {
  return await controlIDRequest(device, 'get_configuration.fcgi', 'POST', config)
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
    console.log('ControlID API Request:', { action, deviceId, params: Object.keys(params) })

    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .single()

    if (deviceError || !deviceData) {
      throw new Error(`Device not found: ${deviceId}`)
    }

    const creds = deviceData.api_credentials as Record<string, any> || {}
    const device: DeviceCredentials = {
      ip: deviceData.controlid_ip_address,
      username: creds.username || creds.user,
      password: creds.password,
      port: creds.port || 80
    }

    let result: ControlIDResponse

    switch (action) {
      case 'getDeviceInfo':
        result = await getDeviceInfo(device)
        break

      case 'getDeviceStatus':
        result = await getDeviceStatus(device)
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

      case 'enrollUser': {
        // Use worker code (integer) as ControlID ID
        const workerCode = Number(params.workerCode || params.userId)
        const registration = String(params.registration || params.userId)
        result = await enrollUser(device, workerCode, params.userName, registration, params.userPhoto)
        break
      }

      case 'removeUser': {
        const removeCode = Number(params.workerCode || params.userId)
        result = await removeUser(device, removeCode)
        break
      }

      case 'releaseAccess':
        result = await releaseAccess(device, params.doorId)
        break

      case 'configureDevice':
        result = await configureDevice(device, params.config)
        break

      case 'getConfiguration':
        result = await getConfiguration(device, params.config)
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
