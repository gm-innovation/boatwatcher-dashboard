

## Correção da Integração Desktop — Projetos, Agentes e Dispositivos

### Problemas Identificados (dados reais do banco)

**1. Três agentes existem, causando confusão:**
- "Engenharia01" (1ff56fcb) — `created_by` = user_id, recriado pelo bootstrap do Desktop
- "Engenharia" (b7a3fd5d) — `created_by` = NULL, criado manualmente via UI do Servidor Local
- "Engenharia" antigo (e49cea39) — `created_by` = NULL, sem project_id, órfão

**2. Dispositivo "Engenharia" está vinculado ao agente ERRADO:**
- `devices.agent_id` = 1ff56fcb ("Engenharia01")
- O Servidor Local usa o token do agente "Engenharia" (b7a3fd5d)
- `download-devices` filtra por `agent_id`, então retorna 0 dispositivos para o Servidor Local

**3. Bootstrap do Desktop sempre cria novo agente:**
- O dedup busca por `created_by = user_id`, mas "Engenharia" tem `created_by = NULL`
- O skip por token existente funciona apenas se `sync_meta` já tiver o token — mas no Desktop app (não o Servidor Local), o SQLite pode estar vazio

**4. Projetos não aparecem no Desktop:**
- O `ProjectContext` depende de `role` ser carregado antes de buscar projetos
- Se `role` ainda for `null` durante o primeiro fetch, o caminho não-admin é usado, que depende de `user_companies` (vazio para este user)
- Race condition: `checkUserRole` é assíncrono e `useEffect` de projetos pode executar antes do role ser definido

### Plano de Correção

#### 1. Corrigir dedup do bootstrap para encontrar agentes com `created_by = NULL`
**Arquivo:** `supabase/functions/agent-sync/index.ts`

Adicionar um 4º fallback no bootstrap: buscar qualquer agente do mesmo `project_id` (independente de `created_by`). Isso encontra o agente "Engenharia" criado manualmente.

```
Ordem de busca:
1. created_by + name (exato)
2. created_by + project_id
3. created_by (qualquer)
4. NOVO: project_id (sem created_by) — encontra agentes manuais
```

Quando reutilizar um agente manual, definir `created_by` para o usuário atual.

#### 2. Rebind automático de dispositivos no bootstrap
**Arquivo:** `supabase/functions/agent-sync/index.ts`

A função `rebindDevices` já existe mas precisa ser verificada. O problema é que o bootstrap retorna o agente existente sem atualizar o `agent_id` dos dispositivos se o agente já existia com o mesmo ID. Verificar que o rebind realmente executa.

#### 3. Corrigir race condition de projetos no Desktop
**Arquivo:** `src/contexts/ProjectContext.tsx`

O `useEffect` que busca projetos depende de `role`, mas `role` começa como `null`. Quando `role` muda de `null` para `'admin'`, o effect re-executa — **isso já funciona** porque `role` está na dependency array. 

O problema real: o `loading` é setado como `false` antes do `role` ser definido, causando um render com "Selecione um projeto" vazio. Adicionar guarda: se `role === null` e `loading` do auth ainda é `true`, não buscar projetos ainda.

#### 4. Limpar agentes órfãos via migração
**Arquivo:** Migração SQL

Deletar o agente órfão antigo (e49cea39) que não tem `project_id`. Opcionalmente, consolidar "Engenharia" e "Engenharia01" em um único agente.

#### 5. Garantir que o Servidor Local rebind dispositivos ao configurar token
**Arquivo:** `electron/local-server-main.js`

Após o `set-agent-token` salvar o token, chamar o endpoint `agent-sync/rebind-devices` ou atualizar diretamente no banco via `download-devices` (que já filtra por `agent_id`). O rebind precisa acontecer no CLOUD — atualizar `devices.agent_id` para o agente cujo token foi configurado.

Adicionar novo action `rebind-devices` na Edge Function:
```
POST agent-sync/rebind-devices
```
Atualiza todos os dispositivos do `project_id` do agente para apontar para o `agent_id` atual.

### Arquivos Impactados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/agent-sync/index.ts` | Fallback dedup por project_id sem created_by; novo action rebind-devices |
| `src/contexts/ProjectContext.tsx` | Aguardar role ser definido antes de buscar projetos |
| `electron/local-server-main.js` | Chamar rebind-devices após set-agent-token |
| Migração SQL | Limpar agente órfão e49cea39 |

### Resultado Esperado
- Servidor Local com token "Engenharia" terá dispositivos vinculados corretamente
- Desktop mostrará projetos após o role admin ser detectado
- Bootstrap não criará agentes duplicados (encontra "Engenharia" mesmo com `created_by=NULL`)
- Dispositivo aparecerá como conectado ao agente no dashboard de conectividade

