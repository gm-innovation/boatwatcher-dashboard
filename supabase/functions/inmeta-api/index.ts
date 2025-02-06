
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

const API_BASE_URL = 'https://homologacao.inmeta.com.br'

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

async function getToken(credentials: InmetaCredentials): Promise<string> {
  console.log('Getting token with email:', credentials.email);
  const url = `${API_BASE_URL}/api/v1/token`;
  console.log('Token request URL:', url);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify(credentials),
      // Add configuration for handling certificates
      mode: 'cors',
      redirect: 'follow',
    })

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
    
    // Add more specific error handling
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('Network connection error - possibly related to SSL/certificates');
    }
    throw error;
  }
}

async function getAccessEvents(token: string, startDate: string, endDate: string): Promise<AccessEvent[]> {
  console.log(`Fetching access events for date range: ${startDate} to ${endDate}`);
  
  const formattedStartDate = `${startDate}T00:00:00`;
  const formattedEndDate = `${endDate}T23:59:59`;
  
  const url = `${API_BASE_URL}/api/v1/eventos-acesso`;
  const requestBody = {
    dataInicial: formattedStartDate,
    dataFinal: formattedEndDate
  };
  
  console.log('Access events request URL:', url);
  console.log('Request body:', JSON.stringify(requestBody));
  console.log('Request headers:', {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'modulo': 'CONTROLE_ACESSO'
  });
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'modulo': 'CONTROLE_ACESSO'
      },
      body: JSON.stringify(requestBody),
      // Add configuration for handling certificates
      mode: 'cors',
      redirect: 'follow',
    });

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
    
    // Add more specific error handling
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
