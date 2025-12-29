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

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  
  console.log(`[echo-auth] ${req.method} request received`);
  console.log(`[echo-auth] Authorization header present:`, !!authHeader);
  
  if (authHeader) {
    console.log(`[echo-auth] Authorization header length:`, authHeader.length);
    console.log(`[echo-auth] Authorization header prefix (first 50 chars):`, authHeader.substring(0, 50));
    
    // Check for common issues
    const hasBearerPrefix = authHeader.startsWith('Bearer ');
    const hasDoubleBearerPrefix = authHeader.startsWith('Bearer Bearer ');
    const tokenPart = hasBearerPrefix ? authHeader.substring(7) : authHeader;
    
    console.log(`[echo-auth] Has 'Bearer ' prefix:`, hasBearerPrefix);
    console.log(`[echo-auth] Has DOUBLE 'Bearer Bearer ' prefix:`, hasDoubleBearerPrefix);
    console.log(`[echo-auth] Token length (after Bearer):`, tokenPart.length);
    
    // Try to decode JWT header to check format
    let jwtInfo: any = null;
    try {
      const parts = tokenPart.split('.');
      if (parts.length === 3) {
        const headerDecoded = JSON.parse(atob(parts[0]));
        const payloadDecoded = JSON.parse(atob(parts[1]));
        jwtInfo = {
          header: headerDecoded,
          payload: {
            iss: payloadDecoded.iss,
            sub: payloadDecoded.sub,
            aud: payloadDecoded.aud,
            exp: payloadDecoded.exp,
            iat: payloadDecoded.iat,
            email: payloadDecoded.email,
          },
          isExpired: payloadDecoded.exp ? (payloadDecoded.exp * 1000) < Date.now() : null,
          expiresIn: payloadDecoded.exp ? Math.floor((payloadDecoded.exp * 1000 - Date.now()) / 1000) : null,
        };
        console.log(`[echo-auth] JWT decoded successfully:`, JSON.stringify(jwtInfo, null, 2));
      } else {
        console.log(`[echo-auth] Token does not have 3 parts (not a valid JWT format)`);
      }
    } catch (e) {
      console.log(`[echo-auth] Failed to decode JWT:`, e.message);
    }
    
    return new Response(
      JSON.stringify({
        hasAuthHeader: true,
        authHeaderLength: authHeader.length,
        authHeaderPrefix: authHeader.substring(0, 20) + '...',
        hasBearerPrefix,
        hasDoubleBearerPrefix,
        tokenLength: tokenPart.length,
        jwtInfo,
        timestamp: new Date().toISOString(),
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  }

  console.log(`[echo-auth] NO Authorization header found!`);
  console.log(`[echo-auth] All headers:`, Object.fromEntries(req.headers.entries()));

  return new Response(
    JSON.stringify({
      hasAuthHeader: false,
      authHeaderLength: 0,
      authHeaderPrefix: null,
      hasBearerPrefix: false,
      hasDoubleBearerPrefix: false,
      tokenLength: 0,
      jwtInfo: null,
      allHeaders: Object.fromEntries(req.headers.entries()),
      timestamp: new Date().toISOString(),
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  );
});
