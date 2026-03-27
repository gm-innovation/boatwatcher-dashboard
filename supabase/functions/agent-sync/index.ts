import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-token',
}

/**
 * Validate timestamp: reject timestamps that are absurdly in the future (> 5 min ahead).
 * Returns the timestamp as-is if valid, or null if it should be rejected.
 * No automatic corrections are applied — the agent is responsible for proper UTC conversion.
 */
function validateTimestamp(ts: string): { valid: boolean; timestamp: string; reason?: string } {
  const parsed = new Date(ts);
  if (isNaN(parsed.getTime())) return { valid: false, timestamp: ts, reason: 'unparseable timestamp' };
  const now = Date.now();
  const diffMs = parsed.getTime() - now;

  // Reject timestamps more than 5 minutes in the future
  if (diffMs > 5 * 60 * 1000) {
    return { valid: false, timestamp: ts, reason: `timestamp ${Math.round(diffMs / 60000)}min in the future` };
  }

  // Detect BRT offset: timestamp is 2h50m–3h10m behind server time
  // This means the agent sent local BRT time without UTC conversion
  const lagMs = now - parsed.getTime();
  if (lagMs > 170 * 60 * 1000 && lagMs < 190 * 60 * 1000) {
    const corrected = new Date(parsed.getTime() + 3 * 3600 * 1000);
    console.log(`[validateTimestamp] BRT correction applied: ${ts} → ${corrected.toISOString()} (lag=${Math.round(lagMs/60000)}min)`);
    return { valid: true, timestamp: corrected.toISOString() };
  }

  return { valid: true, timestamp: ts };
}

function resolveWorkerPhotoPath(photoUrl?: string | null) {
  if (!photoUrl) return null

  const normalized = photoUrl.trim()
  if (!normalized) return null

  if (normalized.startsWith('storage://')) {
    const rest = normalized.replace('storage://', '')
    const slashIndex = rest.indexOf('/')
    if (slashIndex === -1) return null

    const bucket = rest.slice(0, slashIndex)
    const path = rest.slice(slashIndex + 1)
    return bucket === 'worker-photos' && path ? path : null
  }

  if (normalized.startsWith('worker-photos/')) {
    return normalized.replace(/^worker-photos\//, '')
  }

  try {
    const parsed = new URL(normalized)
    const match = parsed.pathname.match(/\/storage\/v1\/(?:object|render\/image)\/(?:public|sign)\/worker-photos\/(.+)$/)
    if (match?.[1]) {
      return decodeURIComponent(match[1])
    }
  } catch {
    // Not a URL, continue with fallback handling.
  }

  return normalized.includes('://') ? null : normalized
}

async function attachWorkerPhotoSignedUrl(supabase: ReturnType<typeof createClient>, worker: Record<string, any>) {
  if (!worker.photo_url) {
    return { ...worker, photo_signed_url: null }
  }

  const photoPath = resolveWorkerPhotoPath(worker.photo_url)
  console.log(`[agent-sync/download-workers] worker=${worker.id} photo_url=${worker.photo_url} resolved_path=${photoPath ?? 'null'}`)

  if (!photoPath) {
    console.warn(`[agent-sync/download-workers] Could not resolve worker photo path for worker ${worker.id}`)
    return { ...worker, photo_signed_url: null }
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from('worker-photos')
    .createSignedUrl(photoPath, 3600)

  if (signedError) {
    console.error(`[agent-sync/download-workers] Failed to sign worker photo for worker ${worker.id}:`, signedError)
    return { ...worker, photo_signed_url: null }
  }

  return { ...worker, photo_signed_url: signedData?.signedUrl ?? null }
}

function getAnonClient(accessToken: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  )
}

async function getAuthenticatedUser(accessToken: string) {
  const authClient = getAnonClient(accessToken)
  const { data, error } = await authClient.auth.getUser()
  if (error) throw error
  return data.user
}

async function resolveBootstrapProjectId(supabase: any, userId: string) {
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  if (roleRow?.role === 'admin') {
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    return project?.id ?? null
  }

  const { data: companyAccess } = await supabase
    .from('user_companies')
    .select('company_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (companyAccess?.company_id) {
    const { data: companyProject } = await supabase
      .from('projects')
      .select('id')
      .eq('client_id', companyAccess.company_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (companyProject?.id) return companyProject.id
  }

  const { data: userProject } = await supabase
    .from('user_projects')
    .select('project_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  return userProject?.project_id ?? null
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
    const url = new URL(req.url)
    const action = url.pathname.split('/').pop() || ''

    if (req.method === 'POST' && action === 'bootstrap') {
      const accessToken = (req.headers.get('authorization') || '').replace('Bearer ', '')
      if (!accessToken) {
        return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const user = await getAuthenticatedUser(accessToken)
      if (!user) {
        return new Response(JSON.stringify({ error: 'Invalid user session' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const body = await req.json().catch(() => ({}))
      const stationName = (body.stationName || `desktop-${user.id.slice(0, 8)}`).toString().trim().slice(0, 120)
      const projectId = await resolveBootstrapProjectId(supabase, user.id)
      const ipAddress = req.headers.get('x-forwarded-for') || 'unknown'

      // 1. Try exact match by created_by + name
      let existingAgent: { id: string; token: string } | null = null
      const { data: exactMatch, error: exactError } = await supabase
        .from('local_agents')
        .select('id, token')
        .eq('created_by', user.id)
        .eq('name', stationName)
        .maybeSingle()
      if (exactError) throw exactError
      existingAgent = exactMatch

      // 2. Fallback: find any agent by same user + same project (dedup)
      if (!existingAgent && projectId) {
        const { data: projectMatch, error: projectError } = await supabase
          .from('local_agents')
          .select('id, token')
          .eq('created_by', user.id)
          .eq('project_id', projectId)
          .maybeSingle()
        if (projectError) throw projectError
        existingAgent = projectMatch
      }

      // 3. Fallback: find any agent by same user (avoid orphans)
      if (!existingAgent) {
        const { data: userMatch, error: userError } = await supabase
          .from('local_agents')
          .select('id, token')
          .eq('created_by', user.id)
          .order('last_seen_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle()
        if (userError) throw userError
        existingAgent = userMatch
      }

      // 4. Fallback: find any agent for same project_id (catches manually-created agents with created_by=NULL)
      if (!existingAgent && projectId) {
        const { data: projectOnlyMatch, error: projectOnlyError } = await supabase
          .from('local_agents')
          .select('id, token')
          .eq('project_id', projectId)
          .order('last_seen_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle()
        if (projectOnlyError) throw projectOnlyError
        existingAgent = projectOnlyMatch
      }

      const rebindDevices = async (agentId: string, pId: string | null) => {
        if (!pId) return
        await supabase.from('devices').update({ agent_id: agentId }).eq('project_id', pId)
      }

      if (existingAgent) {
        const { error: updateError } = await supabase
          .from('local_agents')
          .update({
            name: stationName,
            project_id: projectId,
            created_by: user.id,
            status: 'online',
            sync_status: 'configuring',
            last_seen_at: new Date().toISOString(),
            ip_address: ipAddress,
            version: body.version || null,
          })
          .eq('id', existingAgent.id)

        if (updateError) throw updateError

        await rebindDevices(existingAgent.id, projectId)

        return new Response(JSON.stringify({ success: true, token: existingAgent.token, agentId: existingAgent.id, projectId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const agentToken = crypto.randomUUID()
      const { data: createdAgent, error: insertError } = await supabase
        .from('local_agents')
        .insert({
          name: stationName,
          token: agentToken,
          created_by: user.id,
          project_id: projectId,
          status: 'online',
          sync_status: 'configuring',
          last_seen_at: new Date().toISOString(),
          ip_address: ipAddress,
          version: body.version || null,
        })
        .select('id, token')
        .single()

      if (insertError) throw insertError

      await rebindDevices(createdAgent.id, projectId)

      return new Response(JSON.stringify({ success: true, token: createdAgent.token, agentId: createdAgent.id, projectId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = (req.headers.get('x-agent-token') || req.headers.get('authorization'))?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: agent } = await supabase.from('local_agents').select('id, project_id, status').eq('token', token).maybeSingle()
    if (!agent) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST /upload-logs
    if (req.method === 'POST' && action === 'upload-logs') {
      const { logs } = await req.json()
      if (!Array.isArray(logs) || logs.length === 0) {
        return new Response(JSON.stringify({ error: 'Empty logs' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Direction normalization map (defense-in-depth, mirrors agent.js)
      const dirMap: Record<string, string> = {
        entry: 'entry', entrada: 'entry', in: 'entry', '1': 'entry',
        exit: 'exit', saida: 'exit', saída: 'exit', out: 'exit', '2': 'exit',
      }
      const validStatuses = ['granted', 'denied']

      // Sanitize, normalize, and validate each log individually
      const accepted: Record<string, unknown>[] = []
      const rejected: { index: number; reason: string }[] = []

      for (let i = 0; i < logs.length; i++) {
        const l = logs[i] as Record<string, unknown>
        try {
          // Timestamp is required
          if (!l.timestamp) {
            rejected.push({ index: i, reason: 'missing timestamp' })
            continue
          }

          // Normalize direction
          const rawDir = String(l.direction || 'unknown').toLowerCase().trim()
          const direction = dirMap[rawDir] || 'unknown'

          // Normalize access_status
          let accessStatus = String(l.access_status || '').toLowerCase().trim()
          if (!validStatuses.includes(accessStatus)) {
            // Try to infer from boolean-like values
            if (l.access_status === true || l.access_status === 1) accessStatus = 'granted'
            else if (l.access_status === false || l.access_status === 0) accessStatus = 'denied'
            else accessStatus = 'granted' // default
          }

          // Validate worker_id: only keep valid UUIDs, null out invalid ones
          let workerId = l.worker_id || null
          if (workerId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(workerId))) {
            console.warn(`[agent-sync/upload-logs] Invalid worker_id format: ${workerId}, setting to null`)
            workerId = null
          }

          // Validate device_id similarly
          let deviceId = l.device_id || null
          if (deviceId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(deviceId))) {
            console.warn(`[agent-sync/upload-logs] Invalid device_id format: ${deviceId}, setting to null`)
            deviceId = null
          }

          // Validate timestamp (no automatic corrections)
          const tsCheck = validateTimestamp(String(l.timestamp));
          if (!tsCheck.valid) {
            console.warn(`[agent-sync/upload-logs] Rejecting log index=${i}: ${tsCheck.reason} (raw=${l.timestamp})`);
            rejected.push({ index: i, reason: tsCheck.reason || 'invalid timestamp' });
            continue;
          }

          accepted.push({
            worker_id: workerId,
            device_id: deviceId,
            timestamp: tsCheck.timestamp,
            access_status: accessStatus,
            direction,
            reason: l.reason || null,
            score: l.score != null ? l.score : null,
            worker_name: l.worker_name || null,
            worker_document: l.worker_document || null,
            device_name: l.device_name || null,
            photo_capture_url: l.photo_capture_url || null,
          })
        } catch (e) {
          rejected.push({ index: i, reason: (e as Error).message })
        }
      }

      console.log(`[agent-sync/upload-logs] Agent ${agent.id}: received=${logs.length} accepted=${accepted.length} rejected=${rejected.length}`)
      if (rejected.length > 0) {
        console.warn(`[agent-sync/upload-logs] Rejected logs:`, JSON.stringify(rejected.slice(0, 10)))
      }

      // Resolve local worker_ids to cloud UUIDs using worker_name or worker_document
      for (const log of accepted) {
        const wId = log.worker_id as string | null
        if (!wId) continue

        // Check if this worker_id actually exists in the cloud workers table
        const { data: existingWorker } = await supabase
          .from('workers')
          .select('id')
          .eq('id', wId)
          .maybeSingle()

        if (!existingWorker) {
          // worker_id is a local UUID — try to resolve by name or document
          let resolved = false

          if (log.worker_document) {
            const { data: byDoc } = await supabase
              .from('workers')
              .select('id')
              .eq('document_number', log.worker_document)
              .maybeSingle()
            if (byDoc) {
              console.log(`[agent-sync/upload-logs] Resolved worker_id ${wId} -> ${byDoc.id} via document`)
              log.worker_id = byDoc.id
              resolved = true
            }
          }

          if (!resolved && log.worker_name) {
            const { data: byName } = await supabase
              .from('workers')
              .select('id')
              .eq('name', log.worker_name)
              .maybeSingle()
            if (byName) {
              console.log(`[agent-sync/upload-logs] Resolved worker_id ${wId} -> ${byName.id} via name`)
              log.worker_id = byName.id
              resolved = true
            }
          }

          if (!resolved) {
            console.warn(`[agent-sync/upload-logs] Could not resolve local worker_id ${wId}, setting to null`)
            log.worker_id = null
          }
        }
      }

      let insertedCount = 0
      if (accepted.length > 0) {
        const { error } = await supabase.from('access_logs').insert(accepted)
        if (error) {
          console.error(`[agent-sync/upload-logs] Insert error:`, error)
          throw error
        }
        insertedCount = accepted.length
      }

      await supabase.from('local_agents').update({ last_sync_at: new Date().toISOString(), pending_sync_count: 0, sync_status: 'synced' }).eq('id', agent.id)

      return new Response(JSON.stringify({ success: true, received: logs.length, accepted: insertedCount, rejected: rejected.length, rejectedDetails: rejected.slice(0, 10) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST /upload-operations
    if (req.method === 'POST' && action === 'upload-operations') {
      const { operations } = await req.json()
      if (!Array.isArray(operations) || operations.length === 0) {
        return new Response(JSON.stringify({ error: 'Empty operations' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const results: Array<Record<string, unknown>> = []

      for (const operation of operations) {
        const queueId = operation?.id ?? null
        const entityType = operation?.entity_type ?? null
        const entityId = operation?.entity_id ?? null
        const kind = operation?.operation ?? null
        const payload = operation?.payload ?? {}

        try {
          if (!entityType || !kind) {
            throw new Error('Invalid operation payload')
          }

          if (entityType === 'company') {
            if (kind === 'delete') {
              if (!payload.cloud_id) throw new Error('cloud_id required for deletion')
              const { error } = await supabase.from('companies').delete().eq('id', payload.cloud_id)
              if (error) throw error
              results.push({ queueId, entityType, entityId, operation: kind, success: true, cloudId: payload.cloud_id })
              continue
            }

            const companyPayload = {
              name: payload.name,
              cnpj: payload.cnpj ?? null,
              contact_email: payload.contact_email ?? null,
              logo_url_light: payload.logo_url_light ?? null,
              logo_url_dark: payload.logo_url_dark ?? null,
              status: payload.status ?? 'active',
              vessels: payload.vessels ?? [],
              project_managers: payload.project_managers ?? [],
            }

            if (!companyPayload.name) {
              throw new Error('name is required')
            }

            if (payload.cloud_id) {
              const { error } = await supabase
                .from('companies')
                .update(companyPayload)
                .eq('id', payload.cloud_id)
              if (error) throw error
              results.push({ queueId, entityType, entityId, operation: kind, success: true, cloudId: payload.cloud_id })
              continue
            }

            const { data, error } = await supabase
              .from('companies')
              .insert(companyPayload)
              .select('id')
              .single()
            if (error) throw error
            results.push({ queueId, entityType, entityId, operation: kind, success: true, cloudId: data.id })
            continue
          }

          if (entityType === 'user_company') {
            if (kind === 'delete') {
              if (!payload.cloud_id) throw new Error('cloud_id required for deletion')
              const { error } = await supabase.from('user_companies').delete().eq('id', payload.cloud_id)
              if (error) throw error
              results.push({ queueId, entityType, entityId, operation: kind, success: true, cloudId: payload.cloud_id })
              continue
            }

            if (!payload.user_id || !payload.company_id) {
              throw new Error('user_id and company_id are required')
            }

            if (payload.cloud_id) {
              const { error } = await supabase
                .from('user_companies')
                .update({ user_id: payload.user_id, company_id: payload.company_id, updated_at: new Date().toISOString() })
                .eq('id', payload.cloud_id)
              if (error) throw error
              results.push({ queueId, entityType, entityId, operation: kind, success: true, cloudId: payload.cloud_id })
              continue
            }

            const { data: existing, error: existingError } = await supabase
              .from('user_companies')
              .select('id')
              .eq('user_id', payload.user_id)
              .maybeSingle()
            if (existingError) throw existingError

            if (existing?.id) {
              const { error } = await supabase
                .from('user_companies')
                .update({ company_id: payload.company_id, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
              if (error) throw error
              results.push({ queueId, entityType, entityId, operation: kind, success: true, cloudId: existing.id })
              continue
            }

            const { data, error } = await supabase
              .from('user_companies')
              .insert({ user_id: payload.user_id, company_id: payload.company_id })
              .select('id')
              .single()
            if (error) throw error
            results.push({ queueId, entityType, entityId, operation: kind, success: true, cloudId: data.id })
            continue
          }

          if (entityType === 'company_document') {
            if (kind === 'delete') {
              if (!payload.cloud_id) throw new Error('cloud_id required for deletion')
              const { error } = await supabase.from('company_documents').delete().eq('id', payload.cloud_id)
              if (error) throw error
              results.push({ queueId, entityType, entityId, operation: kind, success: true, cloudId: payload.cloud_id })
              continue
            }

            const documentPayload = {
              company_id: payload.company_id,
              document_type: payload.document_type,
              filename: payload.filename,
              file_url: payload.file_url ?? null,
            }

            if (!documentPayload.company_id || !documentPayload.document_type || !documentPayload.filename) {
              throw new Error('company_id, document_type and filename are required')
            }

            if (payload.cloud_id) {
              const { error } = await supabase
                .from('company_documents')
                .update(documentPayload)
                .eq('id', payload.cloud_id)
              if (error) throw error
              results.push({ queueId, entityType, entityId, operation: kind, success: true, cloudId: payload.cloud_id })
              continue
            }

            const { data, error } = await supabase
              .from('company_documents')
              .insert(documentPayload)
              .select('id')
              .single()
            if (error) throw error
            results.push({ queueId, entityType, entityId, operation: kind, success: true, cloudId: data.id })
            continue
          }

          if (entityType === 'worker_document') {
            if (kind === 'delete') {
              if (!payload.cloud_id) throw new Error('cloud_id required for deletion')
              const { error } = await supabase.from('worker_documents').delete().eq('id', payload.cloud_id)
              if (error) throw error
              results.push({ queueId, entityType, entityId, operation: kind, success: true, cloudId: payload.cloud_id })
              continue
            }

            const documentPayload = {
              worker_id: payload.worker_id,
              document_type: payload.document_type,
              document_url: payload.document_url ?? null,
              expiry_date: payload.expiry_date ?? null,
              issue_date: payload.issue_date ?? null,
              filename: payload.filename ?? null,
              extracted_data: payload.extracted_data ?? null,
              status: payload.status ?? 'valid',
            }

            if (!documentPayload.worker_id || !documentPayload.document_type) {
              throw new Error('worker_id and document_type are required')
            }

            if (payload.cloud_id) {
              const { error } = await supabase
                .from('worker_documents')
                .update(documentPayload)
                .eq('id', payload.cloud_id)
              if (error) throw error
              results.push({ queueId, entityType, entityId, operation: kind, success: true, cloudId: payload.cloud_id })
              continue
            }

            const { data, error } = await supabase
              .from('worker_documents')
              .insert(documentPayload)
              .select('id')
              .single()
            if (error) throw error
            results.push({ queueId, entityType, entityId, operation: kind, success: true, cloudId: data.id })
            continue
          }

          throw new Error(`Unsupported entity type: ${entityType}`)
        } catch (error) {
          results.push({
            queueId,
            entityType,
            entityId,
            operation: kind,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      await supabase.from('local_agents').update({
        last_sync_at: new Date().toISOString(),
        pending_sync_count: results.filter((result) => !result.success).length,
        sync_status: results.some((result) => !result.success) ? 'partial' : 'synced',
      }).eq('id', agent.id)

      return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /download-devices
    if (req.method === 'GET' && action === 'download-devices') {
      const { data: devices, error } = await supabase
        .from('devices')
        .select('id, name, controlid_ip_address, controlid_serial_number, type, status, location, project_id, api_credentials, configuration')
        .eq('agent_id', agent.id)

      if (error) throw error

      // Also fetch agent info and project name
      const { data: agentInfo } = await supabase
        .from('local_agents')
        .select('id, name, project_id, status')
        .eq('id', agent.id)
        .single()

      let projectName = null
      if (agentInfo?.project_id) {
        const { data: project } = await supabase
          .from('projects')
          .select('name')
          .eq('id', agentInfo.project_id)
          .single()
        projectName = project?.name ?? null
      }

      return new Response(JSON.stringify({
        devices: devices || [],
        agent: agentInfo ? { id: agentInfo.id, name: agentInfo.name, project_id: agentInfo.project_id, project_name: projectName } : null,
        timestamp: new Date().toISOString(),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /download-workers
    if (req.method === 'GET' && action === 'download-workers') {
      const since = url.searchParams.get('since') || '1970-01-01T00:00:00Z'

      // In docking operations, all active workers (client staff, subcontractors, crew)
      // need to be available locally — no project/company filter applied
      let { data: workers, error } = await supabase
        .from('workers')
        .select('id, name, code, document_number, photo_url, status, company_id, role, allowed_project_ids, devices_enrolled, job_function_id, birth_date, gender, blood_type, observations, updated_at')
        .gte('updated_at', since)
        .eq('status', 'active')

      if (error) throw error

      // Fallback: if incremental sync returns 0 and we had a real checkpoint, do a full download
      if ((workers || []).length === 0 && since !== '1970-01-01T00:00:00Z') {
        console.log(`[agent-sync/download-workers] Incremental returned 0 for agent=${agent.id}, falling back to full download`)
        const fullResult = await supabase
          .from('workers')
          .select('id, name, code, document_number, photo_url, status, company_id, role, allowed_project_ids, devices_enrolled, job_function_id, birth_date, gender, blood_type, observations, updated_at')
          .eq('status', 'active')
        if (fullResult.error) throw fullResult.error
        workers = fullResult.data
      }

      console.log(`[agent-sync/download-workers] agent=${agent.id} project=${agent.project_id} filter=all-active found=${(workers || []).length}`)

      const workersWithPhotos = await Promise.all((workers || []).map((worker) => attachWorkerPhotoSignedUrl(supabase, worker)))
      return new Response(JSON.stringify({ workers: workersWithPhotos, timestamp: new Date().toISOString() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST /status (heartbeat) — with auto-heal for broken FK references
    if (req.method === 'POST' && action === 'status') {
      const body = await req.json().catch(() => ({}))

      // Build configuration update with telemetry + pipeline metrics
      let configurationUpdate: Record<string, unknown> | undefined = undefined
      if (body.deviceTelemetry || body.pipelineMetrics || body.heartbeatSchemaVersion) {
        // Fetch current configuration to merge
        const { data: currentAgent } = await supabase
          .from('local_agents')
          .select('configuration')
          .eq('id', agent.id)
          .single()
        const existing = (currentAgent?.configuration as Record<string, unknown>) || {}
        configurationUpdate = {
          ...existing,
          ...(body.deviceTelemetry ? { deviceTelemetry: body.deviceTelemetry } : {}),
          ...(body.pipelineMetrics ? { pipelineMetrics: body.pipelineMetrics } : {}),
          heartbeatSchemaVersion: body.heartbeatSchemaVersion || existing.heartbeatSchemaVersion || null,
          lastHeartbeatReceivedAt: new Date().toISOString(),
        }
      }

      // Log pipeline diagnostics for remote debugging
      const schemaV = body.heartbeatSchemaVersion || 0
      const pm = body.pipelineMetrics || {}
      const dtCount = Array.isArray(body.deviceTelemetry) ? body.deviceTelemetry.length : 0
      console.log(`[agent-sync/status] Agent ${agent.id}: schemaV=${schemaV} devices_telemetry=${dtCount} captured=${pm.capturedEventsCount ?? '?'} unsynced=${pm.unsyncedLogsCount ?? '?'} uploaded=${pm.uploadLogsCount ?? '?'} lastUploadErr=${pm.lastUploadLogsError ? 'YES' : 'no'}`)

      const updatePayload: Record<string, unknown> = {
        status: 'online',
        last_seen_at: new Date().toISOString(),
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        version: body.version || null,
        sync_status: body.sync_status || 'idle',
        pending_sync_count: body.pending_count ?? 0,
        ...(configurationUpdate ? { configuration: configurationUpdate } : {}),
      }

      const { error: updateError } = await supabase.from('local_agents').update(updatePayload).eq('id', agent.id)

      // Auto-heal: if FK error on project_id or created_by, null them out and retry
      if (updateError) {
        console.warn(`[agent-sync/status] Update failed for agent ${agent.id}: ${updateError.message}. Attempting auto-heal...`)
        const { error: healError } = await supabase.from('local_agents').update({
          ...updatePayload,
          project_id: null,
          created_by: null,
        }).eq('id', agent.id)
        if (healError) {
          console.error(`[agent-sync/status] Auto-heal also failed: ${healError.message}`)
          throw healError
        }
        console.log(`[agent-sync/status] Auto-healed agent ${agent.id} (cleared broken FK refs)`)
      }

      // Update device connectivity status
      let devicesReceived = 0
      let devicesUpdated = 0
      let heartbeatMode = 'legacy'

      if (body.devices && Array.isArray(body.devices) && body.devices.length > 0) {
        // Full mode: update each device by serial number
        heartbeatMode = 'full'
        devicesReceived = body.devices.length
        for (const deviceStatus of body.devices) {
          const serial = (deviceStatus.serial_number || '').trim()
          if (!serial) continue
          const newStatus = deviceStatus.online ? 'online' : 'offline'
          const { count } = await supabase
            .from('devices')
            .update({ 
              status: newStatus, 
              updated_at: new Date().toISOString(),
            })
            .eq('controlid_serial_number', serial)
            .eq('agent_id', agent.id)
          if (count && count > 0) devicesUpdated += count
        }
      } else {
        // Legacy mode: agent is alive but didn't send device telemetry
        // Mark ALL devices for this agent as online (agent is reachable = devices are reachable)
        const { count } = await supabase
          .from('devices')
          .update({ 
            status: 'online', 
            updated_at: new Date().toISOString(),
          })
          .eq('agent_id', agent.id)
        devicesUpdated = count ?? 0
      }

      console.log(`[agent-sync/status] Agent ${agent.id}: mode=${heartbeatMode} devices_received=${devicesReceived} devices_updated=${devicesUpdated}`)

      return new Response(JSON.stringify({ success: true, agent_id: agent.id, mode: heartbeatMode, devices_received: devicesReceived, devices_updated: devicesUpdated }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST /upload-workers (offline registrations)
    if (req.method === 'POST' && action === 'upload-workers') {
      const { workers } = await req.json()
      if (!Array.isArray(workers) || workers.length === 0) {
        return new Response(JSON.stringify({ error: 'Empty workers' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const mappings: { localId: string; cloudId: string }[] = []
      for (const w of workers) {
        // Check if worker already exists by document_number
        let cloudId = null
        if (w.document_number) {
          const { data: existing } = await supabase.from('workers').select('id').eq('document_number', w.document_number).maybeSingle()
          if (existing) {
            cloudId = existing.id
            // Update existing worker
            await supabase.from('workers').update({
              name: w.name,
              code: w.code || undefined,
              role: w.role,
              company_id: w.company_id || null,
              status: w.status || 'pending_review',
              document_number: w.document_number || undefined,
              photo_url: w.photo_url || undefined,
              job_function_id: w.job_function_id || null,
              birth_date: w.birth_date || null,
              gender: w.gender || null,
              blood_type: w.blood_type || null,
              observations: w.observations || null,
              devices_enrolled: w.devices_enrolled || [],
              allowed_project_ids: agent.project_id ? [agent.project_id] : [],
              updated_at: new Date().toISOString(),
            }).eq('id', cloudId)
          }
        }

        if (!cloudId) {
          // Insert new worker with pending_review status
          const { data: inserted, error: insertError } = await supabase.from('workers').insert({
            name: w.name,
            code: w.code || undefined,
            document_number: w.document_number,
            photo_url: w.photo_url || null,
            company_id: w.company_id || null,
            role: w.role,
            status: 'pending_review',
            job_function_id: w.job_function_id || null,
            birth_date: w.birth_date || null,
            gender: w.gender || null,
            blood_type: w.blood_type || null,
            observations: w.observations || null,
            devices_enrolled: w.devices_enrolled || [],
            allowed_project_ids: agent.project_id ? [agent.project_id] : [],
          }).select('id').single()

          if (insertError) {
            console.error('Insert worker error:', insertError)
            continue
          }
          cloudId = inserted.id
        }

        mappings.push({ localId: w.local_id || w.id, cloudId })
      }

      return new Response(JSON.stringify({ success: true, mappings }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /download-user-companies
    if (req.method === 'GET' && action === 'download-user-companies') {
      const since = url.searchParams.get('since') || '1970-01-01T00:00:00Z'
      const { data: userCompanies, error } = await supabase
        .from('user_companies')
        .select('id, user_id, company_id, created_at, updated_at')
        .gte('updated_at', since)
      if (error) throw error
      return new Response(JSON.stringify({ user_companies: userCompanies || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /download-company-documents
    if (req.method === 'GET' && action === 'download-company-documents') {
      const since = url.searchParams.get('since') || '1970-01-01T00:00:00Z'
      const { data: companyDocuments, error } = await supabase
        .from('company_documents')
        .select('id, company_id, document_type, filename, file_url, created_at, updated_at')
        .gte('updated_at', since)
      if (error) throw error
      return new Response(JSON.stringify({ company_documents: companyDocuments || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /download-companies
    if (req.method === 'GET' && action === 'download-companies') {
      const since = url.searchParams.get('since') || '1970-01-01T00:00:00Z'
      const { data: companies, error } = await supabase
        .from('companies')
        .select('id, name, cnpj, contact_email, logo_url_light, logo_url_dark, status, vessels, project_managers, created_at, updated_at')
        .gte('updated_at', since)
      if (error) throw error
      return new Response(JSON.stringify({ companies: companies || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /download-projects (filtered by agent's project_id and client_id)
    if (req.method === 'GET' && action === 'download-projects') {
      const since = url.searchParams.get('since') || '1970-01-01T00:00:00Z'

      // First get the agent's project to find client_id
      let filterConditions: string[] = []
      if (agent.project_id) {
        filterConditions.push(`id.eq.${agent.project_id}`)
        // Also get client_id of this project to fetch sibling projects
        const { data: agentProject } = await supabase
          .from('projects')
          .select('client_id')
          .eq('id', agent.project_id)
          .maybeSingle()
        if (agentProject?.client_id) {
          filterConditions.push(`client_id.eq.${agentProject.client_id}`)
        }
      }

      let query = supabase
        .from('projects')
        .select('id, name, client_id, status, location, crew_size, commander, chief_engineer, project_type, armador, start_date')
        .gte('updated_at', since)

      if (filterConditions.length > 0) {
        query = query.or(filterConditions.join(','))
      }

      const { data: projects, error } = await query
      if (error) throw error
      return new Response(JSON.stringify({ projects: projects || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /download-worker-documents
    if (req.method === 'GET' && action === 'download-worker-documents') {
      const since = url.searchParams.get('since') || '1970-01-01T00:00:00Z'
      const { data: workerDocuments, error } = await supabase
        .from('worker_documents')
        .select('id, worker_id, document_type, document_url, expiry_date, issue_date, filename, extracted_data, status, created_at, updated_at')
        .gte('updated_at', since)
      if (error) throw error
      return new Response(JSON.stringify({ worker_documents: workerDocuments || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /download-commands — claim pending commands for this agent
    if (req.method === 'GET' && action === 'download-commands') {
      const { data: commands, error } = await supabase
        .from('agent_commands')
        .select('id, device_id, command, payload, status, created_at')
        .eq('agent_id', agent.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(50)

      if (error) throw error

      const claimed = commands || []

      // Mark claimed commands as in_progress to prevent duplicate processing
      if (claimed.length > 0) {
        const claimedIds = claimed.map(c => c.id)
        await supabase
          .from('agent_commands')
          .update({ status: 'in_progress' })
          .in('id', claimedIds)
      }

      // Count remaining pending for diagnostics
      const { count: remainingPending } = await supabase
        .from('agent_commands')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', agent.id)
        .eq('status', 'pending')

      return new Response(JSON.stringify({
        commands: claimed,
        claimedCount: claimed.length,
        remainingPending: remainingPending ?? 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST /upload-command-result — agent reports command execution result
    if (req.method === 'POST' && action === 'upload-command-result') {
      const { command_id, status: cmdStatus, result, error_message } = await req.json()

      if (!command_id || !cmdStatus) {
        return new Response(JSON.stringify({ error: 'command_id and status required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Verify command belongs to this agent
      const { data: cmd, error: cmdError } = await supabase
        .from('agent_commands')
        .select('id, agent_id, device_id, command, payload')
        .eq('id', command_id)
        .eq('agent_id', agent.id)
        .single()

      if (cmdError || !cmd) {
        return new Response(JSON.stringify({ error: 'Command not found or not owned by this agent' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Update command status
      await supabase
        .from('agent_commands')
        .update({
          status: cmdStatus,
          result: result || null,
          error_message: error_message || null,
          executed_at: new Date().toISOString(),
        })
        .eq('id', command_id)

      // If enrollment succeeded, update workers.devices_enrolled
      const payload = cmd.payload as Record<string, any> || {}
      if (cmdStatus === 'completed' && cmd.command === 'enroll_worker' && payload.worker_id) {
        const { data: worker } = await supabase
          .from('workers')
          .select('devices_enrolled')
          .eq('id', payload.worker_id)
          .single()

        if (worker) {
          const enrolled = Array.isArray(worker.devices_enrolled) ? worker.devices_enrolled : []
          if (!enrolled.includes(cmd.device_id)) {
            await supabase
              .from('workers')
              .update({ devices_enrolled: [...enrolled, cmd.device_id] })
              .eq('id', payload.worker_id)
          }
        }
      }

      // If removal succeeded, remove device from workers.devices_enrolled
      if (cmdStatus === 'completed' && cmd.command === 'remove_worker' && payload.worker_id) {
        const { data: worker } = await supabase
          .from('workers')
          .select('devices_enrolled')
          .eq('id', payload.worker_id)
          .single()

        if (worker) {
          const enrolled = Array.isArray(worker.devices_enrolled) ? worker.devices_enrolled : []
          await supabase
            .from('workers')
            .update({ devices_enrolled: enrolled.filter((id: string) => id !== cmd.device_id) })
            .eq('id', payload.worker_id)
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST /rebind-devices
    if (req.method === 'POST' && action === 'rebind-devices') {
      if (!agent.project_id) {
        return new Response(JSON.stringify({ error: 'Agent has no project_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { error: rebindError, count } = await supabase
        .from('devices')
        .update({ agent_id: agent.id })
        .eq('project_id', agent.project_id)
      if (rebindError) throw rebindError
      return new Response(JSON.stringify({ success: true, rebound: count ?? 0, agent_id: agent.id, project_id: agent.project_id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /download-access-logs — download access logs scoped to agent's project devices
    if (req.method === 'GET' && action === 'download-access-logs') {
      const since = url.searchParams.get('since') || '1970-01-01T00:00:00Z'

      // Find device IDs for this agent's project
      let deviceFilter: string[] = []
      if (agent.project_id) {
        const { data: devices } = await supabase
          .from('devices')
          .select('id')
          .eq('project_id', agent.project_id)
        deviceFilter = (devices || []).map(d => d.id)
      }

      if (deviceFilter.length === 0) {
        // No devices for this project — return empty
        return new Response(JSON.stringify({ access_logs: [], timestamp: new Date().toISOString() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data: logs, error } = await supabase
        .from('access_logs')
        .select('id, worker_id, device_id, timestamp, access_status, direction, reason, score, worker_name, worker_document, device_name')
        .in('device_id', deviceFilter)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(500)

      if (error) throw error

      console.log(`[agent-sync/download-access-logs] agent=${agent.id} project=${agent.project_id} since=${since} found=${(logs || []).length}`)

      return new Response(JSON.stringify({ access_logs: logs || [], timestamp: new Date().toISOString() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('agent-sync error:', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
