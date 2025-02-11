
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

const API_BASE_URL = 'https://api.homologacao.inmeta.com.br/api'

interface InmetaCredentials {
  email: string
  senha: string
}

interface AccessEvent {
  id: string
  tipo: string
  data: string
  alvo: {
    id: string
    nome: string
  }
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
      throw new Error(`Failed to get token: ${response.statusText}. Response: ${text}`);
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
  const url = `${API_BASE_URL}/v2/alvos`;
  
  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'modulo': 'CONTROLE_ACESSO'
    };

    console.log('Projects request URL:', url);
    console.log('Request headers:', headers);

    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    console.log('Projects response status:', response.status);
    console.log('Projects response headers:', Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    console.log('Projects response text:', text);

    if (!response.ok) {
      throw new Error(`Failed to get projects: ${response.statusText}. Response: ${text}`);
    }

    const data = JSON.parse(text);
    console.log('Successfully parsed projects response:', data);

    if (!data?.content || !Array.isArray(data.content)) {
      console.error('Invalid response structure:', data);
      throw new Error(`Invalid response format. Full response: ${text}`);
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
    url.searchParams.append('alvoId', projectId);
  }

  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'modulo': 'CONTROLE_ACESSO'
    };

    console.log('Access events request URL:', url.toString());
    console.log('Request headers:', headers);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers
    });

    console.log('Access events response status:', response.status);
    console.log('Access events response headers:', Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    console.log('Access events response text:', text);

    if (!response.ok) {
      throw new Error(`Failed to get access events: ${response.statusText}. Response: ${text}`);
    }

    const data = JSON.parse(text);
    console.log('Successfully parsed access events response:', data);

    if (!data?.content || !Array.isArray(data.content)) {
      console.error('Invalid response structure:', data);
      throw new Error(`Invalid response format. Full response: ${text}`);
    }

    return data.content.map((event: any) => ({
      id: event.id || String(Math.random()),
      tipo: event.tipo,
      data: event.data,
      alvo: {
        id: event.alvo?.id,
        nome: event.alvo?.nome
      },
      agente: event.agente,
      cpfPessoa: event.cpfPessoa,
      tipoPessoa: event.tipoPessoa,
      nomePessoa: event.nomePessoa,
      cargoPessoa: event.cargoPessoa,
      observacoes: event.observacoes,
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

    console.log('Using credentials:', { email: credentials.email, password: '***' });

    const token = await getToken(credentials);
    console.log('Successfully obtained token');

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
