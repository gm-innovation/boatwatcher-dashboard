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

async function getToken(): Promise<string> {
  const url = `${API_BASE_URL}/v1/token`;
  const credentials = {
    email: "googlemarine@teste.com.br",
    senha: "rXYAYKSUI8EExfM"
  };
  
  try {
    console.log('Token request URL:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(credentials)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get token: ${response.statusText}. Response: ${text}`);
    }

    const data = await response.json();
    
    if (!data?.content?.token) {
      throw new Error('Token not found in response');
    }

    return data.content.token;
  } catch (error) {
    console.error('Error getting token:', error);
    throw error;
  }
}

async function getAccessEvents(token: string, startDate: string, endDate: string, alvoId?: string): Promise<AccessEvent[]> {
  const formattedStartDate = `${startDate}T00:00:00-03:00`;
  const formattedEndDate = `${endDate}T23:59:59-03:00`;
  
  const url = new URL(`${API_BASE_URL}/v1/eventos-acesso`);
  url.searchParams.append('dataInicial', formattedStartDate);
  url.searchParams.append('dataFinal', formattedEndDate);
  if (alvoId) {
    url.searchParams.append('alvoId', alvoId);
  }

  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'modulo': 'CONTROLE_ACESSO'
    };

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get access events: ${response.statusText}. Response: ${text}`);
    }

    const data = await response.json();

    if (!data?.content) {
      throw new Error('Invalid response format');
    }

    if (!Array.isArray(data.content)) {
      return [];
    }

    return data.content.map((event: any) => ({
      id: event.id || String(Math.random()),
      tipo: event.tipo,
      data: event.data,
      alvo: event.alvo || '',
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
    return new Response(null, { 
      headers: { 
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    });
  }

  try {
    const { startDate, endDate, alvoId } = await req.json();

    if (!startDate || !endDate) {
      throw new Error('startDate and endDate are required');
    }

    const token = await getToken();
    const events = await getAccessEvents(token, startDate, endDate, alvoId);

    return new Response(
      JSON.stringify({ data: events }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        } 
      }
    );

  } catch (error) {
    console.error('Error in Edge Function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});