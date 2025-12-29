import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface EnrollmentRequest {
  workerId: string
  deviceIds: string[]
}

interface DeviceCredentials {
  ip: string
  username?: string
  password?: string
  port?: number
}

async function enrollUserOnDevice(
  device: DeviceCredentials,
  userId: string,
  userName: string,
  userPhoto?: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = `http://${device.ip}:${device.port || 80}`
  
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (device.username && device.password) {
      const auth = btoa(`${device.username}:${device.password}`)
      headers['Authorization'] = `Basic ${auth}`
    }

    // Cadastrar usuário
    const userResponse = await fetch(`${baseUrl}/users.fcgi`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        object: 'users',
        values: [{
          id: userId,
          name: userName,
          registration: userId,
        }]
      })
    })

    if (!userResponse.ok) {
      const text = await userResponse.text()
      return { success: false, error: `Failed to create user: ${text}` }
    }

    // Se tiver foto, cadastrar biometria facial
    if (userPhoto) {
      const photoResponse = await fetch(`${baseUrl}/user_images.fcgi`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          object: 'user_images',
          values: [{
            user_id: userId,
            image: userPhoto,
            timestamp: Date.now()
          }]
        })
      })

      if (!photoResponse.ok) {
        console.warn('Failed to enroll photo, user created without biometrics')
      }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

async function removeUserFromDevice(
  device: DeviceCredentials,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = `http://${device.ip}:${device.port || 80}`
  
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (device.username && device.password) {
      const auth = btoa(`${device.username}:${device.password}`)
      headers['Authorization'] = `Basic ${auth}`
    }

    const response = await fetch(`${baseUrl}/users.fcgi`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        object: 'users',
        where: { users: { id: userId } }
      })
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { action, workerId, deviceIds } = await req.json()
    console.log('Worker Enrollment Request:', { action, workerId, deviceIds })

    // Buscar dados do trabalhador
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('id, name, photo_url, devices_enrolled')
      .eq('id', workerId)
      .single()

    if (workerError || !worker) {
      throw new Error(`Worker not found: ${workerId}`)
    }

    // Buscar dispositivos
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('id, controlid_ip_address, api_credentials, name')
      .in('id', deviceIds)

    if (devicesError || !devices || devices.length === 0) {
      throw new Error('No valid devices found')
    }

    const results: Record<string, { success: boolean; error?: string }> = {}
    let enrolledDevices = worker.devices_enrolled || []

    // Buscar foto do trabalhador se existir
    let photoBase64: string | undefined
    if (worker.photo_url) {
      try {
        const photoResponse = await fetch(worker.photo_url)
        if (photoResponse.ok) {
          const photoBuffer = await photoResponse.arrayBuffer()
          photoBase64 = btoa(String.fromCharCode(...new Uint8Array(photoBuffer)))
        }
      } catch (e) {
        console.warn('Failed to fetch worker photo:', e)
      }
    }

    for (const device of devices) {
      const deviceCredentials: DeviceCredentials = {
        ip: device.controlid_ip_address,
        username: device.api_credentials?.username,
        password: device.api_credentials?.password,
        port: device.api_credentials?.port || 80
      }

      if (action === 'enroll') {
        const result = await enrollUserOnDevice(
          deviceCredentials,
          worker.id,
          worker.name,
          photoBase64
        )
        results[device.id] = result

        if (result.success && !enrolledDevices.includes(device.id)) {
          enrolledDevices.push(device.id)
        }
      } else if (action === 'remove') {
        const result = await removeUserFromDevice(deviceCredentials, worker.id)
        results[device.id] = result

        if (result.success) {
          enrolledDevices = enrolledDevices.filter((id: string) => id !== device.id)
        }
      }
    }

    // Atualizar lista de dispositivos inscritos do trabalhador
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
