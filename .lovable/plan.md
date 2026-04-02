
Objetivo: corrigir de forma definitiva o cadastro por documentos para que um ASO realmente preencha o formulário, e para que a foto apareça corretamente no campo visual do modal.

Diagnóstico do que está acontecendo hoje:
1. O backend de extração só retorna nome/CPF/data de nascimento/gênero/tipo sanguíneo/função quando o documento já chega classificado como ASO/RG/CPF/CNH.
2. Se o arquivo vem com nome genérico (ex.: `teste3.pdf`), ele entra como `Outros`; nesse caso o schema atual pede só `document_type`, `completion_date` e `expiry_date`.
3. No modal, mesmo quando vier texto extraído, `company_name` nem está sendo mapeado para `company_id`, e `role` pode “sumir” se a função extraída não existir exatamente na lista do Select.
4. A foto hoje depende só de upload manual local; não existe extração/preenchimento de foto a partir do documento, e o acionamento do input ainda usa padrão menos confiável em modal.

Plano de implementação:

1. Corrigir a extração do ASO na função de backend
- Arquivo: `supabase/functions/extract-document-data/index.ts`
- Alterar a estratégia de schema para não depender apenas do nome do arquivo.
- Para documentos `Outros`/desconhecidos, usar um schema “amplo” que também permita retornar:
  - `full_name`
  - `document_number`
  - `birth_date`
  - `gender`
  - `blood_type`
  - `job_function`
  - `company_name`
- Opcionalmente, fazer detecção em 2 etapas:
  - etapa 1: identificar o tipo real pelo conteúdo
  - etapa 2: extrair com o schema certo
- Isso resolve o caso clássico em que o PDF é um ASO, mas o nome do arquivo não contém “aso”.

2. Ajustar o preenchimento automático no modal
- Arquivo: `src/components/workers/NewWorkerDialog.tsx`
- Ao receber `extracted_data`, preencher:
  - `name`
  - `document_number`
  - `birth_date`
  - `gender`
  - `blood_type`
  - `role`
- Normalizar valores antes de aplicar:
  - gênero para os valores aceitos no Select
  - CPF limpo/formatado
  - datas em `YYYY-MM-DD`
- Mapear `company_name` extraído para `company_id` comparando com a lista de empresas.
- Para cargo/função:
  - tentar casar com uma função existente
  - se não houver correspondência exata, manter o texto extraído visível em fallback, em vez de deixar o campo aparentando vazio

3. Corrigir a exibição da foto no local destinado
- Arquivo: `src/components/workers/NewWorkerDialog.tsx`
- Trocar o acionamento do upload de foto para o padrão semântico com `label + input hidden`, que é o padrão mais confiável em modal.
- Garantir que o preview selecionado apareça imediatamente dentro do bloco de foto.
- Manter botão claro de adicionar/alterar/remover foto.
- Se a expectativa for “foto extraída do documento”: hoje isso não existe no pipeline, então a correção imediata será garantir o upload/preview manual funcionando corretamente no local da foto. Extração de retrato do ASO pode virar uma etapa separada se você quiser.

4. Alinhar UI para que o usuário perceba claramente o preenchimento automático
- Arquivo: `src/components/workers/NewWorkerDialog.tsx`
- Após cada documento processado:
  - aplicar os dados extraídos no formulário
  - manter os campos visivelmente atualizados
  - evitar sobrescrever campo já preenchido manualmente sem critério
- Mostrar melhor o estado “dados extraídos” quando houver nome/CPF/função preenchidos com sucesso.

Arquivos envolvidos:
- `supabase/functions/extract-document-data/index.ts`
- `src/components/workers/NewWorkerDialog.tsx`

Resultado esperado após a implementação:
- Um ASO com nome de arquivo genérico ainda preencherá os campos principais.
- Empresa e função passarão a aparecer no formulário quando forem reconhecidas.
- A foto aparecerá corretamente no espaço reservado assim que for selecionada manualmente.
- O modal ficará coerente com o fluxo mostrado nos prints.
