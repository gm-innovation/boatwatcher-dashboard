import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface DeviceCredentials {
  ip: string
  username?: string
  password?: string
  port?: number
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

async function deviceRequest(device: DeviceCredentials, endpoint: string, body: any): Promise<Response> {
  return await fetch(buildUrl(device, endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(device) },
    body: JSON.stringify(body),
  })
}

async function enrollUserOnDevice(
  device: DeviceCredentials,
  workerCode: number,
  userName: string,
  photoBase64?: string
): Promise<{ success: boolean; error?: string; warning?: string }> {
  try {
    // Step 1: Create user via /create_objects.fcgi
    const userResponse = await deviceRequest(device, 'create_objects.fcgi', {
      object: 'users',
      values: [{
        id: workerCode,
        name: userName,
        registration: String(workerCode),
      }]
    })

    if (!userResponse.ok) {
      const text = await userResponse.text()
      return { success: false, error: `Failed to create user: ${text}` }
    }

    // Step 2: Send photo via /user_set_image.fcgi (binary octet-stream)
    if (photoBase64) {
      try {
        const binaryString = atob(photoBase64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }

        const timestamp = Math.floor(Date.now() / 1000)
        const url = buildUrl(device, 'user_set_image.fcgi', `user_id=${workerCode}&timestamp=${timestamp}&match=0`)

        const photoResponse = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream', ...buildAuthHeaders(device) },
          body: bytes,
        })

        if (!photoResponse.ok) {
          console.warn('Failed to enroll photo, user created without biometrics')
        } else {
          const photoResult = await photoResponse.json().catch(() => null)
          if (photoResult && photoResult.success === false) {
            const errors = (photoResult.errors || []).map((e: any) => e.message).join('; ')
            return { success: true, warning: `Foto rejeitada: ${errors}` }
          }
        }
      } catch (photoErr) {
        console.warn('Photo enrollment error:', photoErr.message)
        return { success: true, warning: `Foto falhou: ${photoErr.message}` }
      }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

async function removeUserFromDevice(
  device: DeviceCredentials,
  workerCode: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Step 1: Remove photo via /user_destroy_image.fcgi
    try {
      await deviceRequest(device, 'user_destroy_image.fcgi', { user_id: workerCode })
    } catch (e) {
      console.warn('Failed to remove photo:', e.message)
    }

    // Step 2: Remove user via /destroy_objects.fcgi
    const response = await deviceRequest(device, 'destroy_objects.fcgi', {
      object: 'users',
      where: { users: { id: workerCode } }
    })

    if (!response.ok) {
      const text = await response.text()
      return { success: false, error: `Failed to remove user: ${text}` }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Validate JWT in code
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token)
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { action, workerId, deviceIds } = await req.json()
    console.log('Worker Enrollment Request:', { action, workerId, deviceIds, userId: claimsData.claims.sub })

    // Fetch worker with code field
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('id, name, code, photo_url, devices_enrolled, document_number')
      .eq('id', workerId)
      .single()

    if (workerError || !worker) {
      throw new Error(`Worker not found: ${workerId}`)
    }

    const workerCode = Number(worker.code)

    // Fetch devices
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('id, controlid_ip_address, api_credentials, name')
      .in('id', deviceIds)

    if (devicesError || !devices || devices.length === 0) {
      throw new Error('No valid devices found')
    }

    const results: Record<string, { success: boolean; error?: string; warning?: string }> = {}
    let enrolledDevices = worker.devices_enrolled || []

    // Download worker photo if exists
    let photoBase64: string | undefined
    if (worker.photo_url) {
      try {
        const photoResponse = await fetch(worker.photo_url)
        if (photoResponse.ok) {
          const photoBuffer = await photoResponse.arrayBuffer()
          const bytes = new Uint8Array(photoBuffer)
          let binary = ''
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i])
          }
          photoBase64 = btoa(binary)
        }
      } catch (e) {
        console.warn('Failed to fetch worker photo:', e)
      }
    }

    for (const device of devices) {
      const creds = device.api_credentials as Record<string, any> || {}
      const deviceCredentials: DeviceCredentials = {
        ip: device.controlid_ip_address,
        username: creds.username || creds.user,
        password: creds.password,
        port: creds.port || 80
      }

      if (action === 'enroll') {
        const result = await enrollUserOnDevice(deviceCredentials, workerCode, worker.name, photoBase64)
        results[device.id] = result

        if (result.success && !enrolledDevices.includes(device.id)) {
          enrolledDevices.push(device.id)
        }
      } else if (action === 'remove') {
        const result = await removeUserFromDevice(deviceCredentials, workerCode)
        results[device.id] = result

        if (result.success) {
          enrolledDevices = enrolledDevices.filter((id: string) => id !== device.id)
        }
      }
    }

    // Update worker's enrolled devices list
    await supabase
      .from('workers')
      .update({ devices_enrolled: enrolledDevices })
      .eq('id', workerId)

    const successCount = Object.values(results).filter(r => r.success).length
    const failCount = Object.values(results).filter(r => !r.success).length

    console.log('Enrollment results:', { successCount, failCount, results })

    return new Response(
      JSON.stringify({
        success: failCount === 0,
        message: `${action === 'enroll' ? 'Enrolled' : 'Removed'} on ${successCount}/${devices.length} devices`,
        results,
        devicesEnrolled: enrolledDevices
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Worker Enrollment Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
