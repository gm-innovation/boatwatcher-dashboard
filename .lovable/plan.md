

# Corrigir status padrão no schema Zod do NewWorkerDialog

## Problema

O `NewWorkerDialog.tsx` tem **dois** lugares que definem o default do status:
- **Linha 55** (schema Zod): `status: z.string().default('pending_review')` -- ainda com valor antigo
- **Linha 99** (form defaultValues): `status: 'active'` -- já corrigido

O Zod schema default na linha 55 prevalece quando o campo não é explicitamente preenchido, causando o bug.

## Solução

Alterar linha 55 de `src/components/workers/NewWorkerDialog.tsx`:
- De: `status: z.string().default('pending_review')`
- Para: `status: z.string().default('active')`

Um único arquivo, uma única linha.

