import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[auth-ping] ${req.method} request received`);
  console.log(`[auth-ping] Headers:`, Object.fromEntries(req.headers.entries()));

  // If we reach here, verify_jwt=true passed, so the JWT is valid
  return new Response(
    JSON.stringify({ 
      ok: true, 
      message: 'JWT validated successfully by gateway',
      timestamp: new Date().toISOString()
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  );
});
