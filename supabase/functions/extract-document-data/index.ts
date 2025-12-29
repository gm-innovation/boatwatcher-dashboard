import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Schema de extração baseado no tipo de documento
const getExtractionSchema = (documentType: string) => {
  const baseProperties = {
    document_type: {
      type: "string",
      enum: ["ASO", "NR10", "NR33", "NR35", "RG", "CPF", "CNH", "Outros"],
      description: "Tipo do documento identificado. RETORNE APENAS um destes valores exatos."
    },
    completion_date: {
      type: "string",
      description: "Data de emissão, conclusão ou realização. Formato: YYYY-MM-DD"
    },
    expiry_date: {
      type: "string",
      description: "Data de validade ou vencimento. Formato: YYYY-MM-DD"
    }
  };

  // Campos extras para documentos pessoais (ASO, RG, CPF)
  if (['ASO', 'RG', 'CPF', 'CNH'].includes(documentType) || !documentType) {
    return {
      type: "object",
      properties: {
        ...baseProperties,
        full_name: {
          type: "string",
          description: "Nome completo do trabalhador/pessoa"
        },
        document_number: {
          type: "string",
          description: "CPF (apenas números, sem pontos ou traços)"
        },
        birth_date: {
          type: "string",
          description: "Data de nascimento. Formato: YYYY-MM-DD"
        },
        gender: {
          type: "string",
          enum: ["Masculino", "Feminino"],
          description: "Gênero/Sexo. Retorne 'Masculino' ou 'Feminino'"
        },
        blood_type: {
          type: "string",
          enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
          description: "Tipo sanguíneo"
        },
        job_function: {
          type: "string",
          description: "Cargo ou função profissional"
        },
        company_name: {
          type: "string",
          description: "Nome da empresa/empregador mencionado no documento"
        }
      }
    };
  }

  return {
    type: "object",
    properties: baseProperties
  };
};

// Identificar tipo de documento pelo nome do arquivo
const identifyDocumentType = (filename: string): string => {
  const lowerName = filename.toLowerCase();
  
  if (lowerName.includes('aso') || lowerName.includes('atestado')) return 'ASO';
  if (lowerName.includes('nr10') || lowerName.includes('nr-10') || lowerName.includes('eletric')) return 'NR10';
  if (lowerName.includes('nr33') || lowerName.includes('nr-33') || lowerName.includes('confin')) return 'NR33';
  if (lowerName.includes('nr35') || lowerName.includes('nr-35') || lowerName.includes('altura')) return 'NR35';
  if (lowerName.includes('rg') || lowerName.includes('identidade')) return 'RG';
  if (lowerName.includes('cpf')) return 'CPF';
  if (lowerName.includes('cnh') || lowerName.includes('habilitacao') || lowerName.includes('carteira')) return 'CNH';
  
  return 'Outros';
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { file_url, filename, document_type, worker_id } = await req.json();

    if (!file_url) {
      return new Response(
        JSON.stringify({ error: 'file_url é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[extract-document-data] Iniciando extração de:', filename);
    console.log('[extract-document-data] URL do arquivo:', file_url);

    // Identificar tipo de documento
    const detectedType = document_type || identifyDocumentType(filename || '');
    console.log('[extract-document-data] Tipo detectado:', detectedType);

    // Obter schema de extração
    const extractionSchema = getExtractionSchema(detectedType);

    // Criar prompt para a IA
    const systemPrompt = `Você é um especialista em extrair dados de documentos brasileiros como ASO (Atestado de Saúde Ocupacional), certificados NR (NR10, NR33, NR35), RG, CPF, CNH e outros documentos de trabalhadores.

INSTRUÇÕES IMPORTANTES:
1. Analise cuidadosamente a imagem/PDF do documento
2. Extraia APENAS as informações que você consegue identificar claramente
3. Se não encontrar algum campo, deixe-o vazio ou null
4. NÃO INVENTE dados - se não estiver claro, não preencha
5. Para datas, use o formato YYYY-MM-DD
6. Para CPF, retorne apenas números (sem pontos ou traços)
7. Para gênero, identifique pelo campo "Sexo" ou por indicadores no documento (M=Masculino, F=Feminino)
8. Para tipo sanguíneo, procure por campos como "Tipo Sang.", "Grupo Sang.", etc.

TIPOS DE DOCUMENTO:
- ASO: Atestado de Saúde Ocupacional (contém dados pessoais + data de validade geralmente 1 ano)
- NR10: Certificado de Segurança em Instalações Elétricas
- NR33: Certificado de Espaços Confinados
- NR35: Certificado de Trabalho em Altura
- RG: Documento de Identidade
- CPF: Cadastro de Pessoa Física
- CNH: Carteira Nacional de Habilitação`;

    const userPrompt = `Analise este documento e extraia as informações de acordo com o schema fornecido.
    
Documento: ${filename || 'sem nome'}
Tipo esperado: ${detectedType}

Retorne APENAS um JSON válido com os dados extraídos.`;

    // Chamar Lovable AI Gateway com suporte a imagem
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: file_url } }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_document_data",
              description: "Extrai dados estruturados de um documento",
              parameters: extractionSchema
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_document_data" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos na sua conta Lovable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("[extract-document-data] Erro da API:", response.status, errorText);
      throw new Error(`Erro na API: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('[extract-document-data] Resposta da IA:', JSON.stringify(aiResponse, null, 2));

    // Extrair dados da resposta
    let extractedData: any = {};
    
    if (aiResponse.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      try {
        extractedData = JSON.parse(aiResponse.choices[0].message.tool_calls[0].function.arguments);
      } catch (e) {
        console.error('[extract-document-data] Erro ao parsear argumentos:', e);
      }
    } else if (aiResponse.choices?.[0]?.message?.content) {
      // Fallback: tentar extrair JSON do conteúdo
      const content = aiResponse.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          extractedData = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('[extract-document-data] Erro ao parsear JSON do conteúdo:', e);
        }
      }
    }

    console.log('[extract-document-data] Dados extraídos:', extractedData);

    // Normalizar gênero
    if (extractedData.gender) {
      const genderLower = String(extractedData.gender).toLowerCase();
      if (genderLower.includes('m') && !genderLower.includes('fem')) {
        extractedData.gender = 'Masculino';
      } else if (genderLower.includes('f') || genderLower.includes('fem')) {
        extractedData.gender = 'Feminino';
      }
    }

    // Normalizar tipo de documento
    if (extractedData.document_type) {
      const typeUpper = String(extractedData.document_type).toUpperCase();
      if (typeUpper.includes('ASO') || typeUpper.includes('ATESTADO')) {
        extractedData.document_type = 'ASO';
      } else if (typeUpper.includes('NR10') || typeUpper.includes('NR-10')) {
        extractedData.document_type = 'NR10';
      } else if (typeUpper.includes('NR33') || typeUpper.includes('NR-33')) {
        extractedData.document_type = 'NR33';
      } else if (typeUpper.includes('NR35') || typeUpper.includes('NR-35')) {
        extractedData.document_type = 'NR35';
      }
    } else {
      extractedData.document_type = detectedType;
    }

    // Atualizar trabalhador se worker_id fornecido
    if (worker_id && Object.keys(extractedData).length > 0) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          const { data: worker } = await supabase
            .from('workers')
            .select('*')
            .eq('id', worker_id)
            .single();
          
          if (worker) {
            const updates: any = {};
            
            // Preencher apenas campos vazios
            if (extractedData.full_name && !worker.name) {
              updates.name = extractedData.full_name;
            }
            if (extractedData.document_number && !worker.document_number) {
              updates.document_number = extractedData.document_number;
            }
            if (extractedData.job_function && !worker.role) {
              updates.role = extractedData.job_function;
            }
            
            if (Object.keys(updates).length > 0) {
              await supabase
                .from('workers')
                .update(updates)
                .eq('id', worker_id);
              
              console.log('[extract-document-data] Trabalhador atualizado:', updates);
            }
          }
        }
      } catch (updateError) {
        console.error('[extract-document-data] Erro ao atualizar trabalhador:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        extracted_data: extractedData,
        filename,
        detected_type: detectedType
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[extract-document-data] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
