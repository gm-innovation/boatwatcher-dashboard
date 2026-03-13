import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  // Extract sub-path after /api/
  const path = url.pathname.replace(/^\/api\//, '/').replace(/^\/functions\/v1\/api\//, '/')

  console.log(`[API] ${req.method} ${path}`)

  try {
    const body = await req.json().catch(() => ({}))

    if (path === '/notifications/dao' || path.endsWith('/notifications/dao')) {
      console.log("CONTROLID EVENT:", JSON.stringify(body, null, 2))
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (path === '/notifications/door' || path.endsWith('/notifications/door')) {
      console.log("CONTROLID DOOR EVENT:", JSON.stringify(body, null, 2))
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (path === '/notifications/device_is_alive' || path.endsWith('/notifications/device_is_alive')) {
      console.log("CONTROLID HEARTBEAT:", JSON.stringify(body, null, 2))
      return new Response(JSON.stringify({ status: "ok", alive: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log("UNKNOWN ROUTE:", path, JSON.stringify(body, null, 2))
    return new Response(JSON.stringify({ error: "not_found", path }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error("API Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
