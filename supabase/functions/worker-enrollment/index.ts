import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Extract bucket and path from a storage:// URI or raw bucket path */
function parseStorageRef(photoUrl: string | null): { bucket: string; path: string } | null {
  if (!photoUrl) return null;

  // storage://worker-photos/workers/abc.jpg
  if (photoUrl.startsWith('storage://')) {
    const rest = photoUrl.replace('storage://', '');
    const slashIndex = rest.indexOf('/');
    if (slashIndex === -1) return null;
    return { bucket: rest.substring(0, slashIndex), path: rest.substring(slashIndex + 1) };
  }

  // worker-photos/workers/abc.jpg
  const rawMatch = photoUrl.match(/^(worker-photos|worker-documents)\/(.+)$/);
  if (rawMatch) return { bucket: rawMatch[1], path: rawMatch[2] };

  // Full URL containing /storage/v1/object/...
  const urlMatch = photoUrl.match(
    /\/storage\/v1\/(?:object|render\/image)\/(?:public|sign)\/(worker-photos|worker-documents)\/([^?]+)/,
  );
  if (urlMatch) return { bucket: urlMatch[1], path: decodeURIComponent(urlMatch[2]) };

  return null;
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
    const userId = claimsData.claims.sub
    console.log('Worker Enrollment Request:', { action, workerId, deviceIds, userId })

    // Fetch worker
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('id, name, code, photo_url, devices_enrolled, document_number')
      .eq('id', workerId)
      .single()

    if (workerError || !worker) {
      throw new Error(`Worker not found: ${workerId}`)
    }

    const workerCode = Number(worker.code)

    // --- Generate signed URL for the worker photo ---
    let photoSignedUrl: string | null = null;
    const storageRef = parseStorageRef(worker.photo_url);
    if (storageRef) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from(storageRef.bucket)
        .createSignedUrl(storageRef.path, 3600); // 1 hour

      if (signedError) {
        console.warn('Failed to create signed URL for photo:', signedError.message);
      } else {
        photoSignedUrl = signedData.signedUrl;
      }
    } else if (worker.photo_url && worker.photo_url.startsWith('http')) {
      // Already a full URL (legacy), pass through
      photoSignedUrl = worker.photo_url;
    }

    // Fetch devices with agent_id
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('id, controlid_ip_address, api_credentials, name, agent_id')
      .in('id', deviceIds)

    if (devicesError || !devices || devices.length === 0) {
      throw new Error('No valid devices found')
    }

    const commandType = action === 'remove' ? 'remove_worker' : 'enroll_worker'
    const commandIds: string[] = []
    const errors: Record<string, string> = {}

    for (const device of devices) {
      if (!device.agent_id) {
        errors[device.id] = `Dispositivo "${device.name}" não tem agente local vinculado. Vincule um agente antes de fazer enrollment.`
        continue
      }

      const { data: cmd, error: cmdError } = await supabase
        .from('agent_commands')
        .insert({
          agent_id: device.agent_id,
          device_id: device.id,
          command: commandType,
          payload: {
            worker_id: worker.id,
            worker_code: workerCode,
            worker_name: worker.name,
            document_number: worker.document_number,
            photo_url: worker.photo_url,
            photo_signed_url: photoSignedUrl,
          },
          status: 'pending',
          created_by: userId,
        })
        .select('id')
        .single()

      if (cmdError) {
        console.error(`Failed to queue command for device ${device.id}:`, cmdError)
        errors[device.id] = cmdError.message
      } else {
        commandIds.push(cmd.id)
      }
    }

    const queuedCount = commandIds.length
    const failedCount = Object.keys(errors).length

    console.log('Enrollment queued:', { queuedCount, failedCount, commandIds, photoSignedUrl: !!photoSignedUrl })

    return new Response(
      JSON.stringify({
        success: queuedCount > 0,
        queued: true,
        message: queuedCount > 0
          ? `${queuedCount} comando(s) enfileirado(s) para o agente local executar.${failedCount > 0 ? ` ${failedCount} dispositivo(s) sem agente.` : ''}`
          : 'Nenhum comando enfileirado. Verifique se os dispositivos têm agente local vinculado.',
        commandIds,
        errors: failedCount > 0 ? errors : undefined,
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
