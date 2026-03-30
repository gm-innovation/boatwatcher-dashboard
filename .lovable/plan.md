

## Monitoramento de Disponibilidade e Diagnóstico de Conectividade

### Problema
O sistema só armazena o status **atual** de dispositivos e agentes (`status` + `last_seen_at`). Não há histórico de desconexões, impossibilitando calcular: quantos incidentes ocorreram, duração média de cada queda, e padrões de falha. Também não há visibilidade sobre os diferentes tipos de conexão (servidor local → nuvem, servidor local → dispositivo, navegador → nuvem).

### Solução

#### 1. Nova tabela `connectivity_events` (migração SQL)

Registra cada mudança de status de dispositivos e agentes:

```sql
CREATE TABLE public.connectivity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'device' ou 'agent'
  entity_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  previous_status text,
  new_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_connectivity_events_entity ON connectivity_events(entity_type, entity_id);
CREATE INDEX idx_connectivity_events_created ON connectivity_events(created_at DESC);

ALTER TABLE connectivity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read" ON connectivity_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can insert" ON connectivity_events FOR INSERT TO authenticated WITH CHECK (true);
```

#### 2. Triggers automáticos para capturar mudanças de status

Triggers em `devices` e `local_agents` que inserem um registro em `connectivity_events` sempre que o `status` mudar:

```sql
CREATE OR REPLACE FUNCTION log_device_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO connectivity_events (entity_type, entity_id, project_id, previous_status, new_status)
    VALUES ('device', NEW.id, NEW.project_id, OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_device_status_change
  AFTER UPDATE OF status ON devices
  FOR EACH ROW EXECUTE FUNCTION log_device_status_change();

-- Análogo para local_agents
CREATE OR REPLACE FUNCTION log_agent_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO connectivity_events (entity_type, entity_id, project_id, previous_status, new_status)
    VALUES ('agent', NEW.id, NEW.project_id, OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_agent_status_change
  AFTER UPDATE OF status ON local_agents
  FOR EACH ROW EXECUTE FUNCTION log_agent_status_change();
```

#### 3. Atualizar `ConnectivityDashboard.tsx`

Adicionar uma nova seção **"Disponibilidade"** com:

- **Nova query**: buscar `connectivity_events` dos últimos 7 dias agrupados por entidade
- **Cards de disponibilidade** (por dispositivo/agente):
  - Total de incidentes de desconexão (transições para offline)
  - Tempo médio de cada desconexão (calculado pela diferença entre evento offline e próximo online)
  - Uptime % dos últimos 7 dias
- **Gráfico de timeline** (Recharts `AreaChart`):
  - Eixo X: últimos 7 dias
  - Eixo Y: quantidade de incidentes por dia
  - Separado por dispositivos vs agentes
- **Seção "Diagnóstico de Conexões"**: cards mostrando o status de cada camada de conectividade:
  - **Navegador → Nuvem**: verificação de latência via `supabase.from('projects').select('id').limit(1)` com timestamp
  - **Agente → Nuvem**: baseado no `last_seen_at` do agente (heartbeat a cada 60s)
  - **Agente → Dispositivo**: baseado no campo `status` de cada device (atualizado pelo heartbeat)
  - Cada camada mostra: status (online/offline), latência/tempo desde último contato, e contagem de falhas recentes

#### 4. Layout no dashboard

No **modo normal**, a seção de Disponibilidade aparece entre os gráficos e a tabela de dispositivos. No **modo maximizado**, ela ocupa uma terceira linha compacta abaixo dos gráficos na coluna esquerda.

```text
┌─ Disponibilidade (7 dias) ────────────────────────────────────┐
│  ┌────────┬──────────┬──────────┐  ┌─ Incidentes/Dia ───────┐ │
│  │Uptime  │Incidentes│Tempo Méd.│  │  ▄  ▄▄    ▄            │ │
│  │ 94.2%  │   8      │  23 min  │  │ ██▄██████▄██           │ │
│  └────────┴──────────┴──────────┘  └─────────────────────────┘ │
├─ Diagnóstico de Conexões ─────────────────────────────────────┤
│  [🟢 Web→Nuvem 45ms] [🟢 Agente→Nuvem 30s] [🟡 Agente→Disp] │
│                                      2/3 dispositivos ok      │
└───────────────────────────────────────────────────────────────┘
```

### Detalhes Técnicos

- Query de eventos: `supabase.from('connectivity_events').select('*').gte('created_at', 7daysAgo).order('created_at')`
- Cálculo de uptime: soma dos intervalos online / período total × 100
- Cálculo de tempo médio: para cada par offline→online, diferença em minutos, depois média
- Gráfico usa `AreaChart` do Recharts (já disponível)
- Teste de latência web→nuvem: `performance.now()` antes/depois da query
- Refresh a cada 30s junto com as outras queries

