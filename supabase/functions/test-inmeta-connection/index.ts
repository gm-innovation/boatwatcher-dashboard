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

  try {
    const { email, password, environment } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, message: 'Email e senha são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine API URL based on environment
    const baseUrl = environment === 'homologation' 
      ? 'https://homolog-api.inmeta.com.br'
      : 'https://api.inmeta.com.br';

    console.log(`Testing Inmeta API connection to ${baseUrl}`);

    // Try to authenticate with Inmeta API
    const authResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (authResponse.ok) {
      const data = await authResponse.json();
      console.log('Inmeta API authentication successful');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Conexão bem sucedida',
          token: data.token ? 'Token recebido' : undefined
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const errorText = await authResponse.text();
      console.log(`Inmeta API authentication failed: ${authResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Falha na autenticação: ${authResponse.status}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error testing Inmeta connection:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || 'Erro ao conectar com a API' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
