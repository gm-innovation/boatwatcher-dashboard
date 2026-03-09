

# Etapa 2: Script Python do Agente Local

## Objetivo
Substituir o script Python inline básico (linhas 87-175 do `AgentManagement.tsx`) por uma versão com SQLite local e sync queue, mantido como arquivo separado para download.

## O que será feito

### 1. Criar `public/controlid_agent.py`
Script Python modular (~250 linhas) com:

- **SQLite local**: tabelas `workers`, `access_logs`, `sync_queue`
- **ControlID client**: login via session, polling de eventos (`/access_logs.fcgi`)
- **Sync engine**: upload de logs pendentes via `agent-sync/upload-logs`, download de workers via `agent-sync/download-workers`, heartbeat via `agent-sync/status`
- **Main loop**: 3 threads — polling do dispositivo, sync com cloud, heartbeat
- **Configuração via `config.json`**: token, URLs, IPs dos dispositivos, intervalos

### 2. Atualizar `AgentManagement.tsx` (apenas o script inline)
- Substituir a const `pythonAgentScript` (linhas 87-175) por um botão de download que aponta para `/controlid_agent.py`
- Adicionar template de `config.json` para copiar
- Atualizar instruções de instalação para mencionar o `config.json`

## Arquivos alterados

| Arquivo | Ação | Tamanho estimado |
|---------|------|-----------------|
| `public/controlid_agent.py` | Criar | ~250 linhas |
| `src/components/devices/AgentManagement.tsx` | Editar linhas 87-175 e instruções | Pequena edição |

## Nota
O script será dividido em classes curtas (DatabaseManager, ControlIDClient, SyncEngine, Agent) para facilitar manutenção.

