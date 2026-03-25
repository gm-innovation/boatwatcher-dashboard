

## Enrollment direto via Local Server no Desktop

### Problema

Quando um trabalhador é criado ou editado no Desktop, o auto-enrollment (linha 155 de `WorkerManagement.tsx`) sempre chama `supabase.functions.invoke("worker-enrollment")`, que enfileira comandos na nuvem via `agent_commands`. No Desktop com servidor local ativo, deveria chamar diretamente o Local Server (`/api/workers/:id/enrollment`), que se comunica com o hardware ControlID na mesma rede.

### Correção

**Arquivo: `src/components/workers/WorkerManagement.tsx`** (linhas 153-172)

Substituir o bloco de auto-enrollment por lógica condicional:

1. **Desktop com Local Server disponível**: chamar `localControlId.enrollWorker(workerId, deviceIds)` via `localServerProvider`. Como o Local Server resolve os dispositivos do projeto localmente, precisamos buscar os `deviceIds` dos dispositivos vinculados aos projetos selecionados antes de chamar.

2. **Web / Desktop sem Local Server**: manter o fluxo atual via `supabase.functions.invoke("worker-enrollment")` (que enfileira em `agent_commands`).

A lógica usará `shouldUseLocalServer()` de `runtimeProfile.ts` para decidir o caminho. No caminho local, os dispositivos serão resolvidos buscando do local server todos os dispositivos dos projetos em `allowed_project_ids`.

```text
Fluxo atual (Desktop):
  createWorker → supabase.functions.invoke("worker-enrollment")
  → agent_commands (nuvem) → polling pelo agente → execução tardia

Fluxo corrigido (Desktop com Local Server):
  createWorker → localControlId.enrollWorker(workerId, deviceIds)
  → POST /api/workers/:id/enrollment → ControlID direto → resultado imediato
```

**Arquivo: `src/lib/localServerProvider.ts`**

Adicionar uma variante de `enrollWorker` que aceita apenas `workerId` (sem `deviceIds` obrigatórios), resolvendo os dispositivos automaticamente no lado do servidor. Alternativamente, o local server já suporta receber deviceIds — basta resolver no frontend antes de chamar.

**Arquivo: `server/routes/workers.js`**

Verificar se o endpoint `POST /:id/enrollment` suporta receber uma lista vazia de `deviceIds` e resolver automaticamente os dispositivos do projeto do trabalhador. Se não, adicionar essa lógica para paridade com a edge function `worker-enrollment`.

### Detalhes técnicos

- Importar `shouldUseLocalServer` e `localControlId` no `WorkerManagement.tsx`
- No `onSubmit`, após salvar o worker, verificar `await shouldUseLocalServer()`
- Se local: buscar dispositivos via `localDevices.list()`, filtrar pelos projetos do worker, chamar `localControlId.enrollWorker()`
- Se cloud: manter `supabase.functions.invoke()` atual
- Tratar resultado do local server (que já retorna `{ success, message, results }`) para exibir toast adequado

### Arquivos afetados
- `src/components/workers/WorkerManagement.tsx`
- `server/routes/workers.js` (se necessário adicionar resolução automática de devices)

