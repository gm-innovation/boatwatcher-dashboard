
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

const API_BASE_URL = 'https://api.homologacao.inmeta.com.br/api'

// Dados fictícios baseados nas imagens fornecidas
const mockEvents = [
  {
    id: "1",
    nomePessoa: "Colaborador 17",
    cargoPessoa: "Técnico",
    data: "2025-02-06T11:04:17",
    vinculoColaborador: {
      empresa: "NOVA ALAMEDA"
    }
  },
  {
    id: "2",
    nomePessoa: "Colaborador 13",
    cargoPessoa: "Assistente",
    data: "2025-02-06T11:02:49",
    vinculoColaborador: {
      empresa: "BEN MOINHOS SMART LIFE"
    }
  },
  {
    id: "3",
    nomePessoa: "Colaborador 02 da empresa terceirizada RHS",
    cargoPessoa: "Encanador",
    data: "2023-01-14T17:16:19",
    vinculoColaborador: {
      empresa: "RHS INSTALACOES ELETRICAS"
    }
  },
  {
    id: "4",
    nomePessoa: "Colaborador 01 da empresa terceirizada RHS",
    cargoPessoa: "Encanador",
    data: "2023-01-14T17:14:33",
    vinculoColaborador: {
      empresa: "RHS INSTALACOES ELETRICAS"
    }
  },
  {
    id: "5",
    nomePessoa: "Colaborador terceirizado 7",
    cargoPessoa: "Analista",
    data: "2023-01-14T14:34:43",
    vinculoColaborador: {
      empresa: "Empresa terceirizada 7"
    }
  },
  {
    id: "6",
    nomePessoa: "Colaborador terceirizado 5",
    cargoPessoa: "Coordenador da Qualidade",
    data: "2023-01-14T14:18:45",
    vinculoColaborador: {
      empresa: "Empresa terceirizada 5"
    }
  },
  {
    id: "7",
    nomePessoa: "Ranieri Francisco Serafin",
    cargoPessoa: "Engenheiro Civil",
    data: "2023-01-14T14:15:18",
    vinculoColaborador: {
      empresa: "Empresa terceirizada 5"
    }
  },
  {
    id: "8",
    nomePessoa: "Colaborador 14",
    cargoPessoa: "Encanador",
    data: "2023-01-14T14:26:20",
    vinculoColaborador: {
      empresa: "Empresa terceirizada 7"
    }
  },
  {
    id: "9",
    nomePessoa: "Colaborador terceirizado 10",
    cargoPessoa: "Encanador",
    data: "2023-01-14T14:27:24",
    vinculoColaborador: {
      empresa: "RHS INSTALACOES ELETRICAS"
    }
  },
  {
    id: "10",
    nomePessoa: "Colaborador terceirizado 11",
    cargoPessoa: "Encanador",
    data: "2023-01-14T14:27:48",
    vinculoColaborador: {
      empresa: "Empresa terceirizada 7"
    }
  }
];

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

async function getAccessEvents(token: string, startDate: string, endDate: string): Promise<AccessEvent[]> {
  console.log(`Mock data being used for date range: ${startDate} to ${endDate}`);
  
  // Mapear os eventos mock para o formato esperado
  const events = mockEvents.map((event) => ({
    id: event.id,
    name: event.nomePessoa,
    role: event.cargoPessoa,
    arrival_time: event.data,
    photo_url: '',
    vinculoColaborador: {
      empresa: event.vinculoColaborador.empresa
    }
  }));

  console.log('Returning mock events:', events);
  return events;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, startDate, endDate } = await req.json();
    console.log('Received request with params:', { action, startDate, endDate });

    let result;
    
    switch (action) {
      case 'getAccessEvents':
        if (!startDate || !endDate) {
          console.error('Missing required date parameters');
          throw new Error('Missing required date parameters');
        }
        console.log('Getting mock events...');
        result = await getAccessEvents("mock-token", startDate, endDate);
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
