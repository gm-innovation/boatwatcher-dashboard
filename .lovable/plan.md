

## Corrigir status padrão do trabalhador

### Causa raiz
O `z.string().default('active')` do Zod nem sempre funciona como valor inicial do react-hook-form quando o campo não é "tocado". O `watchedStatus` pode ser `undefined`, e o Radix Select com `value={undefined}` pode se comportar de forma inconsistente ao submeter.

O worker #6 (ADRIANO MOURA VALE) foi criado hoje às 16:11 já com `pending_review`, confirmando que o bug persiste apesar da mudança anterior.

### Correção

**Arquivo: `src/components/workers/NewWorkerDialog.tsx`**

1. Reordenar as opções do Select para que "Ativo" seja a primeira (visualmente coerente com o default)
2. Usar fallback explícito no `value` do Select: `value={watchedStatus || 'active'}` 
3. Garantir que no `onSubmit`, o status tenha fallback: `status: data.status || 'active'`

Essas 3 mudanças eliminam qualquer cenário onde o status possa ser `undefined` ou cair no primeiro item da lista.

### Arquivos alterados
- `src/components/workers/NewWorkerDialog.tsx` — 3 linhas ajustadas

