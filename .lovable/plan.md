

## Correções: Atualizador Desktop e Sincronização do Código do Trabalhador

### Problema 1: Botão "Verificar atualizações" não faz nada

O painel mostra "Atualizador não configurado" porque a `updateFeedUrl` está vazia. Ao clicar no botão, `checkForUpdates()` retorna `{ ok: false, reason: 'not_configured' }` silenciosamente — o componente não trata esse retorno.

**Correção no `DesktopUpdater.tsx`:**
- Tratar o retorno de `checkForUpdates()`: se `reason === 'not_configured'`, exibir toast informando que a URL precisa ser configurada
- Adicionar um campo de input para configurar a URL de atualização diretamente no painel (usando `electronAPI.setUpdateUrl()` já exposto no preload)
- Mostrar a URL atual (via `electronAPI.getUpdateUrl()`) para o operador saber se está configurada
- Após salvar a URL, atualizar o status automaticamente

### Problema 2: Código do trabalhador não sincronizado

O campo `code` é um `serial` no Postgres (auto-incremento). O `Worker` type em `src/types/supabase.ts` **não inclui** o campo `code`, embora ele exista no banco e seja retornado nas queries. No contexto da sincronização com o local server:

- A edge function `download-workers` já inclui `code` no select
- O `upsertWorkerFromCloud` já persiste `code` no SQLite local
- O local server já usa `worker.code` no enrollment

O problema provável é que ao **criar** um trabalhador via Desktop (que usa `localWorkers.create()`), o código não é gerado porque o SQLite local não tem a sequence serial do Postgres. O `code` só será preenchido quando o sync baixar o worker da nuvem.

**Correção:**
- Adicionar `code` ao tipo `Worker` em `src/types/supabase.ts`
- No `createWorker` via cloud, garantir que o `code` retornado é refletido na UI imediatamente (já funciona via `.select().single()`)
- Para criação local: após salvar no local server, disparar sync ou buscar o `code` do cloud após o insert

### Arquivos afetados
- `src/components/desktop/DesktopUpdater.tsx` — adicionar config de URL + feedback no botão
- `src/types/supabase.ts` — adicionar `code: number` ao `Worker`

### Detalhes técnicos

**DesktopUpdater — nova seção de configuração:**
```
[URL de atualização: _________________ ] [Salvar]
```
- Usa `api.getUpdateUrl()` para ler o valor atual
- Usa `api.setUpdateUrl(url)` para salvar
- Após salvar, chama `handleCheck()` automaticamente

**handleCheck — tratamento do retorno:**
```typescript
const result = await api.updater.checkForUpdates();
if (!result.ok) {
  if (result.reason === 'not_configured') {
    toast({ title: 'URL não configurada', description: '...' });
  } else if (result.reason === 'not_packaged') {
    toast({ title: 'Modo desenvolvimento', description: '...' });
  }
}
```

