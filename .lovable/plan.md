

# Servidor Local Dedicado — Arquitetura com Redundância

## O Problema

Você está certo. Se o banco de dados SQLite está **dentro do computador do operador** e essa máquina falha (HD queimou, formatou, etc.), todos os dados locais são perdidos. Precisamos de um **servidor local separado** que centralize os dados e sirva como ponto de resiliência.

## Arquitetura Proposta

```text
┌──────────────────────┐     ┌──────────────────────────────┐
│  PC do Operador      │     │  Servidor Local (mini PC)    │
│  (Electron - UI)     │────►│                              │
│                      │ LAN │  API REST local (Express)    │
│  - Interface React   │     │  SQLite / PostgreSQL         │
│  - Sem banco local   │     │  Agente ControlID embutido   │
│  - "Thin client"     │     │  Motor de Sync com Cloud     │
└──────────────────────┘     └──────────────┬───────────────┘
                                            │ quando há internet
                                            ▼
                                      ┌───────────┐
                                      │   Cloud   │
                                      └───────────┘
```

**Mudança-chave**: O Electron no PC do operador vira um **"thin client"** — ele mostra a interface mas busca dados de um servidor local na rede (ex: `http://192.168.1.100:3001`). O banco de dados, o agente ControlID e o sync ficam no servidor local.

## Vantagens

- **Redundância**: Se o PC do operador quebrar, troca a máquina e aponta para o mesmo servidor local. Dados intactos.
- **Múltiplos operadores**: Vários PCs podem acessar o mesmo servidor local.
- **Backup**: O servidor local pode fazer backup do SQLite para um pendrive/HD externo automaticamente.

## Implementação

### 1. Criar `server/` — API REST local (Express.js)

Um servidor Express.js que expõe endpoints REST para todas as operações CRUD. Roda no servidor local (mini PC, NUC, ou qualquer máquina dedicada).

Arquivo `server/index.js`:
- Express com rotas REST: `/api/workers`, `/api/companies`, `/api/projects`, `/api/access-logs`, `/api/devices`
- Usa o mesmo `database.js` existente (SQLite)
- Agente ControlID embutido (mesmo `agent.js`)
- Motor de sync com cloud (mesmo `sync.js`)
- Roda na porta 3001

### 2. Adaptar Electron para "thin client"

Modificar `electron/main.js` e `preload.js`:
- Remover SQLite local do Electron
- Todas as chamadas IPC passam a fazer `fetch()` para o servidor local
- Configuração do IP/porta do servidor local (tela de settings ou arquivo `.env`)

### 3. Criar `src/lib/localServerProvider.ts`

Novo provider que faz `fetch()` para a API REST local em vez de acessar SQLite diretamente. O `useDataProvider` detecta:
- **Web**: Supabase
- **Electron**: API REST local (via fetch para `http://servidor:3001`)

### 4. Instalador do Servidor Local

Script de instalação separado para o servidor:
- `server/install.sh` / `server/install.bat`
- Instala Node.js + dependências
- Configura como serviço do sistema (systemd no Linux, NSSM no Windows)
- Inicia automaticamente com o boot da máquina

### 5. Backup automático

`server/backup.js` — copia o arquivo SQLite periodicamente para um diretório configurável (pendrive, pasta de rede).

## Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `server/index.js` | Criar — API REST Express |
| `server/routes/workers.js` | Criar — rotas de workers |
| `server/routes/companies.js` | Criar — rotas de companies |
| `server/routes/projects.js` | Criar — rotas de projects |
| `server/routes/access-logs.js` | Criar — rotas de logs |
| `server/routes/devices.js` | Criar — rotas de devices |
| `server/backup.js` | Criar — backup automático do SQLite |
| `server/install.sh` | Criar — script de instalação Linux |
| `server/install.bat` | Criar — script de instalação Windows |
| `server/package.json` | Criar — dependências do servidor |
| `src/lib/localServerProvider.ts` | Criar — provider que chama API local |
| `src/hooks/useDataProvider.ts` | Editar — usar localServerProvider no Electron |
| `electron/main.js` | Editar — remover SQLite, apontar para servidor |
| `electron/preload.js` | Editar — proxy para API local |

O `database.js`, `sync.js` e `agent.js` existentes são **reutilizados** dentro do `server/`, sem duplicação.

