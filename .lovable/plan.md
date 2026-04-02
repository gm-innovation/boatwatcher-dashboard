

## Corrigir 3 problemas: tipo "Outros", cargo/função auto-criar, e foto

### Problema 1: Documento mostra "Outros" em vez do tipo real

**Causa**: O enum do schema da edge function inclui "Outros" como opção válida. A IA, quando não tem certeza, retorna "Outros". E no frontend (linha 929), exibe `doc.type` diretamente.

**Solução**:
- **Edge function** (`supabase/functions/extract-document-data/index.ts`): Remover "Outros" do enum do schema. Adicionar mais tipos ao enum se necessário. Instruir a IA a sempre identificar o tipo real do documento pelo conteúdo — nunca retornar "Outros". Se não souber, deve retornar o nome mais descritivo possível.
- Alterar a propriedade `document_type` no schema para um `string` livre (sem enum restritivo), com description instruindo a retornar o tipo identificado (ASO, NR10, NR33, NR35, RG, CPF, CNH, ou o nome descritivo se for outro tipo).
- No frontend (linha 929), manter a lógica atual — já mostra o tipo retornado.

### Problema 2: Cargo/Função não preenchido quando não existe no banco

**Causa**: O `Select` do cargo (linhas 564-573) só renderiza items de `jobFunctions`. Se a IA extrair "Eletricista" e não existir no banco, o Select fica vazio visualmente apesar do valor estar setado internamente.

**Solução** em `src/components/workers/NewWorkerDialog.tsx`:
- Importar `useCreateJobFunction` do hook existente
- No `processDocument`, após extrair `job_function`:
  1. Tentar match com função existente
  2. Se não encontrar: criar automaticamente via `createJobFunction.mutateAsync({ name: data.job_function })`
  3. Após criar, invalidar query de job-functions e setar o valor no formulário
- No `Select` de cargo, adicionar o valor extraído como item temporário se não estiver na lista (fallback até o refetch completar)

### Problema 3: Foto não aparece

**Causa**: Preciso verificar se o `label htmlFor="worker-photo-upload"` e o `input id="worker-photo-upload"` estão corretamente pareados. O código parece correto (linhas 610-635), mas o `DialogContent` pode estar interceptando cliques. 

**Solução** em `src/components/workers/NewWorkerDialog.tsx`:
- Adicionar `onClick={(e) => e.stopPropagation()}` no label do upload para evitar que o Dialog intercepte o clique
- Garantir que o `input` não está sendo removido/recriado pelo React — usar key estável
- Mover o `input` para fora do card/label container para evitar conflitos de eventos no Radix Dialog

### Arquivos alterados
- `supabase/functions/extract-document-data/index.ts` — remover "Outros" do enum, tornar `document_type` string livre
- `src/components/workers/NewWorkerDialog.tsx` — auto-criar cargo inexistente, fix do upload de foto

