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
    const body = await req.json()
    const { action, workerId, workerIds: providedWorkerIds, deviceIds: providedDeviceIds } = body
    const userId = claimsData.claims.sub

    // --- BULK MODE: process multiple workers in one call ---
    const bulkWorkerIds: string[] = providedWorkerIds && providedWorkerIds.length > 0
      ? providedWorkerIds
      : workerId ? [workerId] : [];

    if (bulkWorkerIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'workerId ou workerIds é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Worker Enrollment Request:', { action, bulkWorkerIds: bulkWorkerIds.length, providedDeviceIds, userId })

    // Fetch all workers in one query
    const { data: allWorkers, error: allWorkersError } = await supabase
      .from('workers')
      .select('id, name, code, photo_url, devices_enrolled, document_number, allowed_project_ids, company_id')
      .in('id', bulkWorkerIds)

    if (allWorkersError) throw allWorkersError
    if (!allWorkers || allWorkers.length === 0) {
      throw new Error(`Nenhum trabalhador encontrado`)
    }

    // Collect all unique project IDs across all workers
    const allProjectIds = [...new Set(allWorkers.flatMap(w => w.allowed_project_ids || []))]

    // Resolve device IDs once for all workers if not provided
    let resolvedDeviceIds: string[] = providedDeviceIds && providedDeviceIds.length > 0
      ? providedDeviceIds
      : [];

    if (resolvedDeviceIds.length === 0 && allProjectIds.length > 0) {
      const { data: resolvedDevices, error: devicesResolveError } = await supabase
        .from('devices')
        .select('id, project_id')
        .in('project_id', allProjectIds)
        .not('agent_id', 'is', null)

      if (devicesResolveError) throw devicesResolveError
      resolvedDeviceIds = (resolvedDevices || []).map(d => d.id)
    }

    if (resolvedDeviceIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          queued: false,
          message: 'Nenhum dispositivo com agente local encontrado nos projetos.',
          commandIds: [],
          workerCount: bulkWorkerIds.length,
          resolvedDeviceCount: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch all target devices with agent info
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('id, controlid_ip_address, api_credentials, name, agent_id, project_id')
      .in('id', resolvedDeviceIds)

    if (devicesError || !devices || devices.length === 0) {
      throw new Error('No valid devices found')
    }

    // Generate signed URLs for all unique photos in parallel
    const photoSignedUrls = new Map<string, string | null>()
    await Promise.all(allWorkers.map(async (worker) => {
      if (!worker.photo_url) {
        photoSignedUrls.set(worker.id, null)
        return
      }
      const storageRef = parseStorageRef(worker.photo_url)
      if (storageRef) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from(storageRef.bucket)
          .createSignedUrl(storageRef.path, 3600)
        photoSignedUrls.set(worker.id, signedError ? null : signedData.signedUrl)
      } else if (worker.photo_url.startsWith('http')) {
        photoSignedUrls.set(worker.id, worker.photo_url)
      } else {
        photoSignedUrls.set(worker.id, null)
      }
    }))

    const commandType = action === 'remove' ? 'remove_worker' : 'enroll_worker'
    const allCommandIds: string[] = []
    const errors: Record<string, string> = {}

    // Build all commands to insert in batch
    const commandsToInsert: any[] = []
    for (const worker of allWorkers) {
      const workerCode = Number(worker.code)
      const photoSignedUrl = photoSignedUrls.get(worker.id) || null

      // Filter devices to only those matching this worker's projects (if not using providedDeviceIds)
      const workerProjectIds = worker.allowed_project_ids || []
      const targetDevices = providedDeviceIds && providedDeviceIds.length > 0
        ? devices
        : devices.filter(d => workerProjectIds.includes(d.project_id))

      for (const device of targetDevices) {
        if (!device.agent_id) {
          errors[`${worker.id}:${device.id}`] = `Dispositivo "${device.name}" sem agente local.`
          continue
        }

        commandsToInsert.push({
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
      }
    }

    // Batch insert all commands
    if (commandsToInsert.length > 0) {
      const { data: insertedCmds, error: insertError } = await supabase
        .from('agent_commands')
        .insert(commandsToInsert)
        .select('id')

      if (insertError) {
        throw new Error(`Falha ao enfileirar comandos: ${insertError.message}`)
      }
      allCommandIds.push(...(insertedCmds || []).map(c => c.id))
    }

    // Update workers.devices_enrolled for enroll action
    if (allCommandIds.length > 0 && action !== 'remove') {
      for (const worker of allWorkers) {
        const workerProjectIds = worker.allowed_project_ids || []
        const enrolledDeviceIds = devices
          .filter(d => d.agent_id && workerProjectIds.includes(d.project_id) && !errors[`${worker.id}:${d.id}`])
          .map(d => d.id)
        const existingEnrolled = worker.devices_enrolled || []
        const mergedEnrolled = [...new Set([...existingEnrolled, ...enrolledDeviceIds])]
        if (mergedEnrolled.length > existingEnrolled.length) {
          await supabase.from('workers').update({ devices_enrolled: mergedEnrolled }).eq('id', worker.id)
        }
      }
    }

    const failedCount = Object.keys(errors).length
    console.log('Enrollment queued:', {
      workerCount: allWorkers.length,
      commandCount: allCommandIds.length,
      failedCount,
      deviceCount: devices.length,
    })

    return new Response(
      JSON.stringify({
        success: allCommandIds.length > 0,
        queued: true,
        message: allCommandIds.length > 0
          ? `${allCommandIds.length} comando(s) enfileirado(s) para ${allWorkers.length} trabalhador(es).${failedCount > 0 ? ` ${failedCount} erro(s).` : ''}`
          : 'Nenhum comando enfileirado.',
        commandIds: allCommandIds,
        workerCount: allWorkers.length,
        resolvedDeviceCount: devices.length,
        errors: failedCount > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

    // (bulk logic handled above)

  } catch (error: unknown) {
    console.error('Worker Enrollment Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
