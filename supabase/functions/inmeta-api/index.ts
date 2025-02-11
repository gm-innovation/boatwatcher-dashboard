
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

const API_BASE_URL = 'https://api.homologacao.inmeta.com.br/api'

interface InmetaCredentials {
  email: string
  senha: string
}

interface AccessEvent {
  tipo: string
  data: string
  alvo: object
  agente: string
  cpfPessoa: string
  tipoPessoa: string
  nomePessoa: string
  cargoPessoa: string
  observacoes: string
  vinculoColaborador: object
}

interface TokenResponse {
  token: string
}

async function getToken(credentials: InmetaCredentials): Promise<string> {
  console.log('Getting token with email:', credentials.email);
  const url = `${API_BASE_URL}/v1/token`;
  console.log('Token request URL:', url);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(credentials),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    
    console.log('Token request status:', response.status);
    console.log('Token response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token request failed:', response.status, errorText);
      throw new Error(`Failed to get token: ${response.statusText} (${response.status}). Response: ${errorText}`);
    }

    const data = await response.json() as TokenResponse;
    console.log('Token response data:', data);
    
    if (!data.token) {
      throw new Error('Token not found in response');
    }

    console.log('Token obtained successfully');
    return data.token.trim(); // Ensure no whitespace in token
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
    throw error;
  }
}

async function getAccessEvents(token: string, startDate: string, endDate: string): Promise<AccessEvent[]> {
  console.log(`Fetching access events for date range: ${startDate} to ${endDate}`);
  
  const formattedStartDate = `${startDate}T00:00:00`;
  const formattedEndDate = `${endDate}T23:59:59`;
  
  // Construct URL with query parameters
  const url = new URL(`${API_BASE_URL}/v1/eventos-acesso`);
  url.searchParams.append('dataInicial', formattedStartDate);
  url.searchParams.append('dataFinal', formattedEndDate);
  
  console.log('Access events request URL:', url.toString());
  console.log('Using authorization token:', token);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const headers = {
      'Authorization': `Bearer ${token.trim()}`,
      'Accept': 'application/json',
      'modulo': 'CONTROLE_ACESSO'
    };

    console.log('Request headers:', headers);

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
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
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, startDate, endDate } = await req.json();
    console.log('Received request with params:', { action, startDate, endDate });

    const credentials = {
      email: Deno.env.get('INMETA_EMAIL'),
      senha: Deno.env.get('INMETA_PASSWORD')
    };

    if (!credentials.email || !credentials.senha) {
      console.error('Missing API credentials');
      throw new Error('Missing API credentials');
    }

    console.log('Using credentials with email:', credentials.email);

    let result;
    
    switch (action) {
      case 'getAccessEvents':
        if (!startDate || !endDate) {
          console.error('Missing required date parameters');
          throw new Error('Missing required date parameters');
        }
        console.log('Getting token and fetching access events...');
        const token = await getToken(credentials);
        result = await getAccessEvents(token, startDate, endDate);
        break;
      
      default:
        console.error('Invalid action:', action);
        throw new Error('Invalid action');
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
