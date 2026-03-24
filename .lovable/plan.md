

## Testes de Comunicação Inter-Camadas no DiagnosticsPanel

### Objetivo
Adicionar uma nova seção ao DiagnosticsPanel que valide a cadeia completa: **Web/Desktop → Cloud → Local Server**, permitindo identificar exatamente onde a comunicação falha.

### Fase 1: Comunicação entre sistemas (Web ↔ Cloud ↔ Local Server)

Nova seção "Conectividade Inter-Camadas" no DiagnosticsPanel com 4 testes:

**1. Agent Heartbeat (Cloud → Local Server)**
- Consulta `local_agents` para verificar `last_seen_at` do agente mais recente do projeto
- Verde: < 2 min | Amarelo: < 10 min | Vermelho: > 10 min ou inexistente
- Confirma que o Local Server está reportando heartbeats à nuvem

**2. Agent Sync Endpoint (Cloud responde ao Local Server)**
- Invoca `agent-sync/download-devices` via `supabase.functions.invoke` com o token do agente ativo (lido de `local_agents`)
- Valida que a cloud consegue servir dados ao servidor local
- Mostra quantidade de dispositivos retornados

**3. Local Server Health (Desktop only)**
- Chama `localHealth.check()` + `localSync.getStatus()`
- Mostra: modo (cloud-sync/local-only), online/offline, último sync, pendências, configurado/não configurado

**4. Roundtrip Completo (Web → Cloud → DB)**
- Já existe parcialmente (DB check + auth). Será agrupado visualmente nesta seção

### Alterações técnicas

**Arquivo:** `src/components/admin/DiagnosticsPanel.tsx`

- Adicionar novo card entre o card de Edge Functions e o Summary Cards (linha ~831)
- 4 testes com estado individual (`useState` para cada resultado)
- Botão "Testar Tudo" que executa todos os testes em sequência
- Cada teste tem botão individual e mostra resultado em Badge (OK/Atenção/Erro) com detalhes

Lógica principal:
```text
// Teste 1: Agent Heartbeat
const { data: agents } = await supabase
  .from('local_agents')
  .select('id, name, token, last_seen_at, status, sync_status')
  .eq('project_id', selectedProjectId)
  .order('last_seen_at', { ascending: false })
  .limit(1)

// Teste 2: Agent Sync Endpoint
const { data, error } = await supabase.functions.invoke('agent-sync', {
  body: {},
  headers: { 'x-agent-token': agent.token }
})
// Invoca o path /download-devices com o token do agente

// Teste 3: Local Server (Desktop only)
const health = await localHealth.check()
const syncStatus = await localSync.getStatus()
```

### O que NÃO muda
- Testes existentes (DB, auth, storage, edge functions) permanecem inalterados
- ConnectivityDashboard permanece como está (foco em status de dispositivos/agentes)
- Nenhuma alteração em edge functions ou tabelas

