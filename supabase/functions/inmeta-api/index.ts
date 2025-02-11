
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

const API_BASE_URL = 'https://api.homologacao.inmeta.com.br/api'

// Dados fictícios para teste
const mockEvents = [
  {
    id: "1",
    nomePessoa: "João Silva",
    cargoPessoa: "Soldador",
    data: new Date().toISOString(),
    vinculoColaborador: {
      empresa: "Metalúrgica ABC"
    }
  },
  {
    id: "2",
    nomePessoa: "Maria Santos",
    cargoPessoa: "Engenheira",
    data: new Date().toISOString(),
    vinculoColaborador: {
      empresa: "Construtora XYZ"
    }
  },
  {
    id: "3",
    nomePessoa: "Pedro Oliveira",
    cargoPessoa: "Técnico",
    data: new Date().toISOString(),
    vinculoColaborador: {
      empresa: "Metalúrgica ABC"
    }
  },
  {
    id: "4",
    nomePessoa: "Ana Costa",
    cargoPessoa: "Inspetora",
    data: new Date().toISOString(),
    vinculoColaborador: {
      empresa: "Qualidade Total Ltda"
    }
  },
  {
    id: "5",
    nomePessoa: "Carlos Souza",
    cargoPessoa: "Montador",
    data: new Date().toISOString(),
    vinculoColaborador: {
      empresa: "Construtora XYZ"
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

interface TokenResponse {
  content: {
    token: string
  }
}

async function getToken(credentials: InmetaCredentials): Promise<string> {
  // Simulando um token válido para teste
  return "token-mock-12345";
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
