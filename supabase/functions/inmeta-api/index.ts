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

async function getToken(credentials: InmetaCredentials): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  })

  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.statusText}`)
  }

  const data = await response.json()
  return data.token
}

async function getAccessEvents(token: string, startDate: string, endDate: string): Promise<AccessEvent[]> {
  const response = await fetch(
    `${API_BASE_URL}/v1/eventos-acesso?dataInicial=${startDate}&dataFinal=${endDate}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'modulo': 'CONTROLE_ACESSO'
      }
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to get access events: ${response.statusText}`)
  }

  return response.json()
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, startDate, endDate } = await req.json()

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
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})