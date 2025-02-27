import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

const API_BASE_URL = 'https://api.homologacao.inmeta.com.br'

interface InmetaCredentials {
  email: string
  senha: string
}

interface AccessEvent {
  tipo: string
  data: string
  alvo: string
  agente: string
  cpfPessoa: string
  tipoPessoa: string
  nomePessoa: string
  cargoPessoa: string
  observacoes: string
  vinculoColaborador: {
    empresa: string
  }
}

const INMETA_CREDENTIALS = {
  email: 'googlemarine@teste.com.br',
  senha: 'rXYAYKSUI8EExfM'
}

async function getToken(credentials: InmetaCredentials): Promise<string> {
  console.log('Getting token with email:', credentials.email);
  const url = `${API_BASE_URL}/api/v1/token`;
  console.log('Token request URL:', url);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify(credentials),
      signal: controller.signal,
      // @ts-ignore - Adding Deno-specific TLS configuration
      client: {
        allowInsecure: true // Allow self-signed certificates
      }
    });

    clearTimeout(timeoutId);
    
    console.log('Token request status:', response.status);
    console.log('Token response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token request failed:', response.status, errorText);
      throw new Error(`Failed to get token: ${response.statusText} (${response.status}). Response: ${errorText}`);
    }

    const data = await response.json();
    console.log('Token obtained successfully');
    return data.token;
  } catch (error) {
    console.error('Error in getToken:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      cause: error.cause,
      stack: error.stack
    });
    
    if (error.name === 'AbortError') {
      console.error('Request timed out after 30 seconds');
      throw new Error('Request timed out while trying to get token');
    }
    
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('Network connection error - possibly related to SSL/certificates');
    }
    throw error;
  }
}

async function getAccessEvents(token: string, startDate: string, endDate: string, projectId?: string): Promise<AccessEvent[]> {
  console.log(`Fetching access events for date range: ${startDate} to ${endDate}, projectId: ${projectId}`);
  
  const formattedStartDate = `${startDate}T00:00:00`;
  const formattedEndDate = `${endDate}T23:59:59`;
  
  const url = `${API_BASE_URL}/api/v1/eventos-acesso`;
  const requestBody = {
    dataInicial: formattedStartDate,
    dataFinal: formattedEndDate,
    projetoId: projectId
  };
  
  console.log('Access events request URL:', url);
  console.log('Request body:', JSON.stringify(requestBody));
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'modulo': 'CONTROLE_ACESSO',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      // @ts-ignore - Adding Deno-specific TLS configuration
      client: {
        allowInsecure: true
      }
    });

    clearTimeout(timeoutId);

    console.log('Access events response status:', response.status);
    console.log('Access events response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Access events request failed:', response.status, errorText);
      throw new Error(`Failed to get access events: ${response.statusText} (${response.status}). Response: ${errorText}`);
    }

    const data = await response.json();
    
    // Log detalhado da resposta
    console.log('API Response:', {
      totalEvents: data.length,
      firstEventDate: data[0]?.data,
      lastEventDate: data[data.length - 1]?.data,
      sampleEvent: data[0]
    });
    
    console.log(`Successfully fetched ${data.length} access events`);
    return data;
  } catch (error) {
    console.error('Error in getAccessEvents:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      cause: error.cause,
      stack: error.stack
    });
    
    if (error.name === 'AbortError') {
      console.error('Request timed out after 30 seconds');
      throw new Error('Request timed out while trying to get access events');
    }
    
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('Network connection error - possibly related to SSL/certificates');
    }
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, startDate, endDate, projectId } = await req.json();
    console.log('Received request with:', { action, startDate, endDate, projectId });

    if (action !== 'getAccessEvents') {
      throw new Error('Invalid action');
    }

    const token = await getToken(INMETA_CREDENTIALS);
    const events = await getAccessEvents(token, startDate, endDate, projectId);

    return new Response(
      JSON.stringify({
        data: events,
        success: true
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in Edge Function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
