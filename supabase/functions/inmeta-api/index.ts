
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
  content: {
    token: string
  }
}

async function getToken(credentials: InmetaCredentials): Promise<string> {
  console.log('Getting token with email:', credentials.email);
  const url = `${API_BASE_URL}/v1/token`;
  console.log('Token request URL:', url);
  console.log('Request body:', JSON.stringify(credentials));
  
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
    
    const responseText = await response.text();
    console.log('Raw response text:', responseText);
    
    if (!response.ok) {
      console.error('Token request failed:', response.status, responseText);
      throw new Error(`Failed to get token: ${response.statusText} (${response.status}). Response: ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText) as TokenResponse;
    } catch (parseError) {
      console.error('Error parsing token response:', parseError);
      throw new Error(`Failed to parse token response: ${responseText}`);
    }

    console.log('Parsed token response:', data);
    
    if (!data?.content?.token) {
      console.error('Invalid token response structure:', data);
      throw new Error('Token not found in response. Full response: ' + JSON.stringify(data));
    }

    console.log('Token obtained successfully');
    return data.content.token.trim();
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
    
    const responseText = await response.text();
    console.log('Raw access events response:', responseText);

    if (!response.ok) {
      console.error('Access events request failed:', response.status, responseText);
      throw new Error(`Failed to get access events: ${response.statusText} (${response.status}). Response: ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Error parsing access events response:', parseError);
      throw new Error(`Failed to parse access events response: ${responseText}`);
    }

    console.log('Parsed access events response:', data);

    // Garantir que temos um array de eventos
    if (!data?.content || !Array.isArray(data.content)) {
      console.error('Invalid access events response structure:', data);
      return [];
    }

    // Mapear os eventos para o formato esperado
    const events = data.content.map((event: any) => ({
      id: event.id || String(Math.random()),
      name: event.nomePessoa || 'Nome não informado',
      role: event.cargoPessoa || 'Cargo não informado',
      arrival_time: event.data || new Date().toISOString(),
      photo_url: event.photoUrl || '',
      vinculoColaborador: {
        empresa: event.vinculoColaborador?.empresa || 'Empresa não informada'
      }
    }));

    console.log('Processed events:', events);
    return events;
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

    console.log('Returning result:', result);

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
