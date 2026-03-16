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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const token = (req.headers.get('x-agent-token') || req.headers.get('authorization'))?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: agent } = await supabase.from('local_agents').select('id, project_id, status').eq('token', token).maybeSingle()
    if (!agent) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const url = new URL(req.url)
    const action = url.pathname.split('/').pop() || ''

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
              company_id: w.company_id,
              status: w.status || 'pending_review',
              updated_at: new Date().toISOString(),
            }).eq('id', cloudId)
          }
        }

        if (!cloudId) {
          // Insert new worker with pending_review status
          const { data: inserted, error: insertError } = await supabase.from('workers').insert({
            name: w.name,
            document_number: w.document_number,
            company_id: w.company_id,
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

    // GET /download-companies
    if (req.method === 'GET' && action === 'download-companies') {
      const since = url.searchParams.get('since') || '1970-01-01T00:00:00Z'
      const { data: companies, error } = await supabase
        .from('companies')
        .select('id, name, cnpj, status, logo_url_light, logo_url_dark')
        .gte('updated_at', since)
      if (error) throw error
      return new Response(JSON.stringify({ companies: companies || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /download-projects
    if (req.method === 'GET' && action === 'download-projects') {
      const since = url.searchParams.get('since') || '1970-01-01T00:00:00Z'
      const { data: projects, error } = await supabase
        .from('projects')
        .select('id, name, client_id, status, location, crew_size')
        .gte('updated_at', since)
      if (error) throw error
      return new Response(JSON.stringify({ projects: projects || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('agent-sync error:', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
