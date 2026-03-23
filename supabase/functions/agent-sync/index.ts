import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-token',
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

async function resolveBootstrapProjectId(supabase: ReturnType<typeof createClient>, userId: string) {
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
      const { error } = await supabase.from('access_logs').insert(logs)
      if (error) throw error

      await supabase.from('local_agents').update({ last_sync_at: new Date().toISOString(), pending_sync_count: 0, sync_status: 'synced' }).eq('id', agent.id)

      return new Response(JSON.stringify({ success: true, count: logs.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
      const { data: workers, error } = await supabase
        .from('workers')
        .select('id, name, code, document_number, photo_url, status, company_id, role, allowed_project_ids, updated_at')
        .contains('allowed_project_ids', [agent.project_id])
        .gte('updated_at', since)
        .eq('status', 'active')

      if (error) throw error

      const workersWithPhotos = await Promise.all((workers || []).map((worker) => attachWorkerPhotoSignedUrl(supabase, worker)))
      return new Response(JSON.stringify({ workers: workersWithPhotos, timestamp: new Date().toISOString() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST /status (heartbeat)
    if (req.method === 'POST' && action === 'status') {
      const body = await req.json().catch(() => ({}))
      await supabase.from('local_agents').update({
        status: 'online',
        last_seen_at: new Date().toISOString(),
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        version: body.version || null,
        sync_status: body.sync_status || 'idle',
        pending_sync_count: body.pending_count ?? 0,
      }).eq('id', agent.id)

      return new Response(JSON.stringify({ success: true, agent_id: agent.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
              role: w.role,
              company_id: w.company_id || null,
              status: w.status || 'pending_review',
              allowed_project_ids: agent.project_id ? [agent.project_id] : [],
              updated_at: new Date().toISOString(),
            }).eq('id', cloudId)
          }
        }

        if (!cloudId) {
          // Insert new worker with pending_review status
          const { data: inserted, error: insertError } = await supabase.from('workers').insert({
            name: w.name,
            document_number: w.document_number,
            company_id: w.company_id || null,
            role: w.role,
            status: 'pending_review',
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

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('agent-sync error:', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
