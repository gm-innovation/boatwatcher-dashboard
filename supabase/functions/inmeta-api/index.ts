
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

// Remove /api from base URL since it's included in the endpoints
const API_BASE_URL = 'https://api.homologacao.inmeta.com.br'

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

async function getToken(credentials: InmetaCredentials): Promise<string> {
  console.log('Getting token...');
  const response = await fetch(`${API_BASE_URL}/api/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  })

  if (!response.ok) {
    console.error('Token request failed:', response.status, response.statusText);
    const text = await response.text();
    console.error('Response body:', text);
    throw new Error(`Failed to get token: ${response.statusText} (${response.status})`);
  }

  const data = await response.json()
  console.log('Token obtained successfully');
  return data.token
}

async function getAccessEvents(token: string, startDate: string, endDate: string): Promise<AccessEvent[]> {
  console.log(`Fetching access events for date range: ${startDate} to ${endDate}`);
  
  // Format dates to ensure they're in YYYY-MM-DD format
  const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
  const formattedEndDate = new Date(endDate).toISOString().split('T')[0];
  
  const url = `${API_BASE_URL}/api/v1/eventos-acesso`;
  const body = {
    dataInicial: formattedStartDate,
    dataFinal: formattedEndDate
  };
  
  console.log('Request URL:', url);
  console.log('Request body:', body);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'modulo': 'CONTROLE_ACESSO'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    console.error('Access events request failed:', response.status, response.statusText);
    const text = await response.text();
    console.error('Response body:', text);
    throw new Error(`Failed to get access events: ${response.statusText} (${response.status})`);
  }

  const data = await response.json()
  console.log(`Successfully fetched ${data.length} access events`);
  return data
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, startDate, endDate } = await req.json()
    console.log('Received request with params:', { action, startDate, endDate });

    // Get credentials from environment variables
    const credentials = {
      email: Deno.env.get('INMETA_EMAIL') || '',
      senha: Deno.env.get('INMETA_PASSWORD') || ''
    }

    if (!credentials.email || !credentials.senha) {
      throw new Error('Missing API credentials')
    }

    let result
    
    switch (action) {
      case 'getAccessEvents':
        if (!startDate || !endDate) {
          throw new Error('Missing required date parameters')
        }
        console.log('Getting token and fetching access events...');
        const token = await getToken(credentials)
        result = await getAccessEvents(token, startDate, endDate)
        break
      
      default:
        throw new Error('Invalid action')
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in Edge Function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
