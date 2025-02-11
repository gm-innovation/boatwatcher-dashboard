
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

const API_BASE_URL = 'https://api.homologacao.inmeta.com.br/api'

interface InmetaCredentials {
  email: string
  senha: string
}

interface AccessEvent {
  id: string
  name: string
  role: string
  arrival_time: string
  photo_url: string
  vinculoColaborador: {
    empresa: string
  }
}

async function getToken(credentials: InmetaCredentials): Promise<string> {
  const url = `${API_BASE_URL}/v1/token`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(credentials)
    });

    if (!response.ok) {
      throw new Error(`Failed to get token: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data?.content?.token) {
      throw new Error('Token não encontrado na resposta');
    }

    return data.content.token;
  } catch (error) {
    console.error('Error getting token:', error);
    throw error;
  }
}

async function getAccessEvents(token: string, startDate: string, endDate: string): Promise<AccessEvent[]> {
  const url = new URL(`${API_BASE_URL}/v1/eventos-acesso`);
  url.searchParams.append('dataInicial', `${startDate}T00:00:00`);
  url.searchParams.append('dataFinal', `${endDate}T23:59:59`);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'modulo': 'CONTROLE_ACESSO'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get access events: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data?.content || !Array.isArray(data.content)) {
      console.error('Invalid response structure:', data);
      throw new Error('Formato de resposta inválido');
    }

    return data.content.map((event: any) => ({
      id: event.id || String(Math.random()),
      name: event.nomePessoa,
      role: event.cargoPessoa,
      arrival_time: event.data,
      photo_url: event.photoUrl || '',
      vinculoColaborador: {
        empresa: event.vinculoColaborador?.empresa || 'Empresa não informada'
      }
    }));
  } catch (error) {
    console.error('Error fetching access events:', error);
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
      throw new Error('Credenciais da API Inmeta não configuradas');
    }

    let result;
    
    switch (action) {
      case 'getAccessEvents':
        if (!startDate || !endDate) {
          throw new Error('Datas inicial e final são obrigatórias');
        }
        const token = await getToken(credentials);
        result = await getAccessEvents(token, startDate, endDate);
        break;
      
      default:
        throw new Error('Ação inválida');
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
