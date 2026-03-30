

## Centro de Monitoramento Multi-Projeto

Reescrever `ConnectivityDashboard.tsx` como uma tela completa de monitoramento com visual de "control center", incluindo gráficos, tabelas detalhadas e indicadores visuais por projeto.

### Alteração

**`src/components/devices/ConnectivityDashboard.tsx`** — reescrita completa:

1. **Dados globais via queries diretas** (sem depender do `selectedProjectId`):
   - `projects` com join em `companies` (nome do cliente)
   - `devices` (todos)
   - `local_agents` (todos)
   - Auto-refresh a cada 30s

2. **Header com indicador de saúde global**:
   - Barra de status pulsante (verde/amarelo/vermelho) baseada na % de dispositivos online
   - Timestamp do último refresh
   - Botão de refresh manual

3. **Cards de resumo global** (4 colunas):
   - Projetos monitorados (total)
   - Dispositivos online/total com Progress bar
   - Agentes online/total
   - Alertas ativos (offline count) com destaque vermelho

4. **Gráfico de barras** (Recharts via `ChartContainer`):
   - Um gráfico de barras empilhadas mostrando por projeto: dispositivos online (verde) vs offline (vermelho)
   - Usa os componentes `ChartContainer`, `ChartTooltip`, `ChartTooltipContent` já existentes

5. **Gráfico de rosca/pie** (Recharts):
   - Distribuição geral: dispositivos online, offline, sem agente
   - Visual compacto ao lado do gráfico de barras (grid 2 colunas)

6. **Tabela de dispositivos completa**:
   - Colunas: Status (dot colorido), Nome, IP, Projeto, Agente vinculado, Último evento (relativo)
   - Ordenável por status (offline primeiro)
   - Todos os projetos juntos, com coluna identificando o projeto

7. **Grid de cards por projeto** (seção inferior):
   - Card compacto por projeto com:
     - Nome do projeto + cliente
     - Badge de saúde (verde/amarelo/vermelho)
     - Mini lista de dispositivos com dots de status
     - Status do agente com last_seen_at relativo
   - Projetos com problemas aparecem primeiro (sort by health)

8. **Painel de alertas** (rodapé):
   - Lista consolidada de todos os dispositivos offline e agentes inativos
   - Identificação do projeto de cada alerta
   - Ícone de severidade e tempo desde a última comunicação

### Detalhes Técnicos

- Queries diretas: `supabase.from('devices').select('*')`, `supabase.from('local_agents').select('*')`, `supabase.from('projects').select('*, companies!client_id(name, logo_url_light)')`
- Agrupamento client-side por `project_id` usando `useMemo`
- Gráficos via `recharts` (já instalado) com `ChartContainer` de `@/components/ui/chart`
- `isAgentOnline` mantém regra de 60s no `last_seen_at`
- `refetchInterval: 30000` em todas as queries
- Saúde do projeto: verde (100% online), amarelo (parcial), vermelho (tudo offline ou sem dispositivos)

```text
┌─ 🟢 Sistema Operacional — Atualizado há 15s ──── [↻ Refresh] ─┐
├────────────┬────────────┬────────────┬─────────────────────────┤
│ 3 Projetos │ 5/7 Online │ 2/3 Agents │ 2 Alertas ⚠            │
│ monitorados│ ████░ 71%  │ ████░ 67%  │                         │
├────────────┴────────────┴────────────┴─────────────────────────┤
│                                                                 │
│  [Gráfico Barras por Projeto]    [Gráfico Rosca Geral]         │
│  Proj A: ████████ 3/3            Online: 71%                   │
│  Proj B: ██████░░ 2/3            Offline: 29%                  │
│  Proj C: ░░░░░░░░ 0/1                                         │
│                                                                 │
├─ Todos os Dispositivos ───────────────────────────────────────┤
│ ● Leitor Proa    | 192.168.1.10 | Proj A | Agente-1 | 2min   │
│ ● Leitor Popa    | 192.168.1.11 | Proj A | Agente-1 | 5min   │
│ ○ Leitor Dique   | 192.168.1.20 | Proj B | —        | 3h     │
│                                                                 │
├─ Projetos ────────────────────────────────────────────────────┤
│ ┌─ Proj A 🟢─┐  ┌─ Proj B 🟡─┐  ┌─ Proj C 🔴─┐            │
│ │ Cliente X   │  │ Cliente Y   │  │ Cliente Z   │            │
│ │ 3/3 disp    │  │ 2/3 disp    │  │ 0/1 disp    │            │
│ │ Agent: ✓    │  │ Agent: ✓    │  │ Sem agente  │            │
│ └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│ ⚠ Alertas                                                      │
│  • Leitor Dique (Proj B) — offline há 3h                       │
│  • Leitor Porto (Proj C) — nunca conectado                     │
└─────────────────────────────────────────────────────────────────┘
```

