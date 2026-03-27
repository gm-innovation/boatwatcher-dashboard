

## Problema

A correção de UTC anterior inverteu a prioridade: `useWorkersOnBoard` agora tenta a **nuvem primeiro** e só cai no local se falhar. Sem internet, a chamada à nuvem vai travar (timeout do Supabase ~30s) antes de usar o servidor local, quebrando a experiência offline do Desktop.

Além disso, outros hooks do Dashboard (`useLastAccessLog`, `useRealtimeAccessLogs`) não têm fallback local e falharão silenciosamente offline.

## Correção

### 1. `useWorkersOnBoard` — Local primeiro no Desktop, nuvem primeiro na Web
**Arquivo:** `src/hooks/useSupabase.ts`

- Importar `usesLocalServer` (já importado) e `isElectron` de `dataProvider`
- Inverter a lógica: se `usesLocalServer()` retorna `true`, tentar o servidor local **primeiro**; se falhar, tentar nuvem como fallback
- Se não é Desktop ou servidor local indisponível, usar nuvem como primário (comportamento web normal)
- Isso mantém a paridade UTC na web e garante resposta instantânea offline no Desktop

```
queryFn: if usesLocalServer() → local first, cloud fallback
         else              → cloud first (web behavior)
```

### 2. Garantir que `fetchWorkersOnBoardFromCloud` tenha timeout curto
**Arquivo:** `src/hooks/useSupabase.ts`

- Sem alteração estrutural necessária — a função já retorna `null` em caso de erro
- O Supabase client em ambiente offline geralmente falha rápido (rede indisponível → erro imediato)
- Se necessário, podemos adicionar `AbortController` com timeout de 5s no futuro

### 3. Garantir que o `executeWithDesktopFallback` continua funcionando para os demais hooks
**Arquivo:** `src/hooks/useDataProvider.ts` — sem alterações necessárias, já usa local-first corretamente

### 4. Dashboard offline: `useLastAccessLog` 
**Arquivo:** `src/hooks/useSupabase.ts`

- Envolver com `executeWithDesktopFallback` para que use dados locais no Desktop offline
- Na web, manter comportamento atual

### Resumo de alterações

| Arquivo | Mudança |
|---|---|
| `src/hooks/useSupabase.ts` | `useWorkersOnBoard`: local-first no Desktop, cloud-first na Web. `useLastAccessLog`: adicionar fallback local |

### Resultado esperado
- Desktop **com internet**: usa local (rápido), dados já sincronizados
- Desktop **sem internet**: usa local, funciona normalmente
- Web: usa nuvem diretamente (sem mudança)
- UTC correto em ambos os cenários (a lógica de UTC no `electron/database.js` já foi corrigida na mensagem anterior)

