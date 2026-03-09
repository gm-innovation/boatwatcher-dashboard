

# Plano: Agente Local com Modo Offline (Offline-First)

## Objetivo
Transformar o agente local de um simples relay em um servidor local completo que funciona sem internet, armazena dados localmente e sincroniza quando a conexão é restabelecida.

## Arquitetura Atual vs Proposta

```text
ATUAL (Online-only):
  Leitor ──HTTP──> Agente ──HTTPS──> Cloud
  (sem internet = parado)

PROPOSTO (Offline-first):
  Leitor ──HTTP──> Agente ──> SQLite Local (sempre funciona)
                      │
                      └──> Fila de Sync ──HTTPS──> Cloud (quando online)
```

## O que será implementado

### 1. Agente Local Python com SQLite (`public/controlid_agent.py`)
- **Banco local SQLite** com tabelas: `workers`, `access_logs`, `sync_queue`, `agent_config`
- **Polling do leitor ControlID** direto via API HTTP local para capturar eventos de acesso em tempo real (independente de internet)
- **Fila de sincronização**: toda operação gera um registro na `sync_queue` com status `pending`
- **Sync automático**: quando detecta internet, envia itens pendentes ao cloud via `agent-relay`
- **Recebimento de dados do cloud**: ao sincronizar, baixa novos trabalhadores/comandos do cloud para o SQLite local
- **Detecção de conectividade**: teste periódico de conexão com o cloud

### 2. Capacidades Offline
- **Cadastro de trabalhadores no leitor**: usa dados do SQLite local, sem precisar do cloud
- **Controle de acesso**: leitor opera sozinho; agente captura logs via API do dispositivo e grava no SQLite
- **Logs de acesso**: armazenados localmente, sincronizados quando internet volta
- **Comandos locais**: fila local de comandos que são executados imediatamente no dispositivo

### 3. Sincronização (quando internet retorna)
- Upload de todos `access_logs` pendentes para o cloud
- Download de novos trabalhadores/atualizações do cloud
- Upload de eventos/status do dispositivo
- Resolução por timestamp (last-write-wins) para conflitos simples

### 4. Nova Edge Function `agent-sync` 
- Endpoint dedicado para sincronização em lote
- Recebe array de access_logs do período offline
- Envia lista de trabalhadores atualizados desde último sync
- Retorna comandos pendentes acumulados

### 5. Atualização da UI (`AgentManagement.tsx`)
- Indicador de "última sincronização" por agente
- Status: online / offline / sincronizando
- Contador de itens pendentes de sync
- Instruções de instalação atualizadas

## Arquivos

| Arquivo | Ação |
|---------|------|
| `public/controlid_agent.py` | Reescrever com SQLite + sync queue |
| `supabase/functions/agent-sync/index.ts` | Novo - endpoint de sync em lote |
| `src/components/devices/AgentManagement.tsx` | Atualizar UI com status de sync |
| `src/hooks/useLocalAgents.ts` | Adicionar campos de sync |
| `supabase/config.toml` | Registrar nova function |

## Limitações
- O dashboard web continua precisando de internet (é uma aplicação web)
- Cadastro de **novos** trabalhadores offline requer que o agente tenha uma interface local (CLI ou API)
- Fotos/documentos grandes ficam na fila até ter conexão

