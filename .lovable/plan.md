

## Plano: Status ativo para admin + ordenação por código

### Problema 1: Status padrão "pending_review" para cadastros feitos pelo admin
O `NewWorkerDialog.tsx` define `status: 'pending_review'` como default na linha 62/172. Cadastros feitos por admin na plataforma devem ser `active` direto. O status `pending_review` só fará sentido quando vier do portal da empresa terceirizada ou do trabalhador (módulos futuros).

**Correção em `src/components/workers/NewWorkerDialog.tsx`:**
- Mudar o default de `status` no schema e no `defaultValues` de `'pending_review'` para `'active'`
- Manter o Select de status no formulário para que o admin possa alterar se quiser

### Problema 2: Lista de trabalhadores ordenada alfabeticamente em vez de por código
Em `src/hooks/useDataProvider.ts` linha 161, o query faz `.order('name')`. Precisa ordenar por `code`.

**Correção em `src/hooks/useDataProvider.ts`:**
- Mudar `.order('name')` para `.order('code', { ascending: true })`

### Arquivos alterados
- `src/components/workers/NewWorkerDialog.tsx` — default status → `'active'`
- `src/hooks/useDataProvider.ts` — ordenação por `code`

