
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

interface InmetaProject {
  id: string
  nome: string
}

async function getToken(credentials: InmetaCredentials): Promise<string> {
  const url = `${API_BASE_URL}/v1/token`;
  
  try {
    console.log('Token request URL:', url);
    console.log('Request body:', JSON.stringify(credentials));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(credentials)
    });

    console.log('Token request status:', response.status);
    console.log('Token response headers:', Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    console.log('Raw response text:', text);

    if (!response.ok) {
      throw new Error(`Failed to get token: ${response.statusText}`);
    }

    try {
      const data = JSON.parse(text);
      console.log('Parsed token response:', data);

      if (!data?.content?.token) {
        console.error('Invalid token response structure:', data);
        throw new Error(`Token not found in response. Full response: ${text}`);
      }

      return data.content.token;
    } catch (parseError) {
      console.error('Error parsing token response:', parseError);
      throw new Error(`Failed to parse token response: ${text}`);
    }
  } catch (error) {
    console.error('Error getting token:', error);
    throw error;
  }
}

async function getProjects(token: string): Promise<InmetaProject[]> {
  const url = new URL(`${API_BASE_URL}/v1/obras`);
  
  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'modulo': 'CONTROLE_ACESSO'
    };

    console.log('Request headers:', headers);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers
    });

    console.log('Projects response status:', response.status);
    console.log('Projects response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      throw new Error(`Failed to get projects: ${response.statusText}`);
    }

    const text = await response.text();
    console.log('Projects response text:', text);

    const data = JSON.parse(text);
    console.log('Successfully fetched projects:', data);

    if (!data?.content || !Array.isArray(data.content)) {
      console.error('Invalid response structure:', data);
      throw new Error('Formato de resposta inválido');
    }

    return data.content.map((project: any) => ({
      id: project.id,
      nome: project.nome
    }));
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
}

async function getAccessEvents(token: string, startDate: string, endDate: string, projectId?: string): Promise<AccessEvent[]> {
  const url = new URL(`${API_BASE_URL}/v1/eventos-acesso`);
  url.searchParams.append('dataInicial', `${startDate}T00:00:00`);
  url.searchParams.append('dataFinal', `${endDate}T23:59:59`);
  if (projectId) {
    url.searchParams.append('obraId', projectId);
  }

  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'modulo': 'CONTROLE_ACESSO'
    };

    console.log('Request headers:', headers);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers
    });

    console.log('Access events response status:', response.status);
    console.log('Access events response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      throw new Error(`Failed to get access events: ${response.statusText}`);
    }

    const text = await response.text();
    console.log('Access events response text:', text);

    const data = JSON.parse(text);
    console.log('Successfully fetched access events:', data);

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
    const { action, startDate, endDate, projectId } = await req.json();
    console.log('Received request with params:', { action, startDate, endDate, projectId });

    const credentials = {
      email: Deno.env.get('INMETA_EMAIL'),
      senha: Deno.env.get('INMETA_PASSWORD')
    };

    if (!credentials.email || !credentials.senha) {
      throw new Error('Credenciais da API Inmeta não configuradas');
    }

    const token = await getToken(credentials);
    let result;
    
    switch (action) {
      case 'getProjects':
        result = await getProjects(token);
        break;

      case 'getAccessEvents':
        if (!startDate || !endDate) {
          throw new Error('Datas inicial e final são obrigatórias');
        }
        result = await getAccessEvents(token, startDate, endDate, projectId);
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
