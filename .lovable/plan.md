

## Diagnóstico Global + Por Projeto

### Problema atual
As queries de dispositivos, documentos, trabalhadores, agentes e access_logs no DiagnosticsPanel consultam todas as tabelas sem filtro de `project_id`. Com múltiplos projetos, os números ficam misturados e a telemetria de agente mostra apenas o último agente (sem contexto de qual projeto).

### Alteração

**`src/components/admin/DiagnosticsPanel.tsx`**

1. **Manter seção global** (ambiente, autenticação, edge functions, banco de dados, storage) sem alterações — esses testes são independentes de projeto.

2. **Adicionar seção "Diagnóstico por Projeto"** após os cards globais:
   - Buscar todos os projetos com seus clientes (`projects` + join `companies`)
   - Renderizar uma lista de cards colapsáveis (`Collapsible`), um por projeto, mostrando:
     - **Dispositivos**: query `devices` filtrada por `project_id` — contagem online/offline/erro
     - **Agente local**: query `local_agents` filtrada por `project_id` — status, versão, última sincronização, telemetria do pipeline
     - **Trabalhadores**: contagem de `workers` cujo `allowed_project_ids` contém o projeto
     - **Documentos a vencer**: query `worker_documents` via join com `workers` filtrados pelo projeto — contagem nos próximos 30 dias
     - **Último acesso**: query `access_logs` via join `devices.project_id` — último evento registrado

3. **Pipeline de Eventos e Telemetria** — quando em modo cloud, iterar sobre todos os agentes (não só o primeiro) agrupando por `project_id`, exibindo métricas de pipeline e telemetria de dispositivos dentro do card do projeto correspondente.

4. **Contadores de resumo** — manter os cards globais de Funcionando/Atenção/Erros, mas somar os diagnósticos por projeto junto com os globais.

### Estrutura visual

```text
┌─ Informações do Ambiente (global) ─────────────────┐
├─ Autenticação (global) ────────────────────────────┤
├─ Edge Functions (global) ──────────────────────────┤
├─ Diagnóstico por Projeto ──────────────────────────┤
│  ▸ Projeto A — Cliente X   [2 disp, 1 agente, OK]  │
│  ▸ Projeto B — Cliente Y   [1 disp, 0 agente, ⚠]  │
│  ▾ Projeto C — Cliente Z   (expandido)              │
│    ├ Dispositivos: 3/3 online                       │
│    ├ Agente: v1.2.3, online, 45 eventos             │
│    ├ Trabalhadores: 12 autorizados                  │
│    ├ Docs a vencer: 2 nos próximos 30 dias          │
│    └ Pipeline: 45 capturados, 0 pendentes           │
├─ Conectividade Inter-Camadas (global) ─────────────┤
├─ Resumo (global + por projeto) ────────────────────┤
└─ Resultados Detalhados ────────────────────────────┘
```

### Detalhes Técnicos

- Queries cloud: `supabase.from('devices').select('*').eq('project_id', pid)`, `supabase.from('local_agents').select('*').eq('project_id', pid)`
- Trabalhadores por projeto: `supabase.from('workers').select('id').contains('allowed_project_ids', [pid])`
- Documentos: subquery via worker_ids do projeto
- Agentes cloud: buscar todos `local_agents` e agrupar por `project_id` em vez de `limit(1)`
- Cada projeto gera `DiagnosticItem[]` locais que alimentam o resumo total

