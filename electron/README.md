# Dock Check Desktop — Build Instructions

## Pré-requisitos

- Node.js 18+ instalado
- npm ou yarn

## Setup

```bash
# 1. Instalar dependências do projeto web
npm install

# 2. Instalar dependências do Electron
npm install --save-dev electron electron-builder
npm install better-sqlite3 uuid

# 3. Configurar variáveis de ambiente
# Crie um arquivo .env na raiz com:
SUPABASE_URL=https://qdscawiwjhzgiqroqkik.supabase.co
SUPABASE_ANON_KEY=<sua_anon_key>
AGENT_TOKEN=<token_do_agente_local>
```

## Desenvolvimento

```bash
# Terminal 1: Rodar o Vite dev server
npm run dev

# Terminal 2: Rodar o Electron em modo dev
npm run electron:dev
```

## Build do Instalador

```bash
# Build do React + Electron
npm run build:electron

# Gera o instalador em ./electron-dist/
# Windows: DockCheck-Setup.exe
# Linux: DockCheck.AppImage
```

## Arquitetura

```
electron/
├── main.js       — Processo principal (janela, IPC)
├── preload.js    — Bridge segura (contextBridge)
├── database.js   — SQLite local (CRUD completo)
├── sync.js       — Sincronização bidirecional com cloud
├── agent.js      — Polling de leitores ControlID
└── README.md     — Este arquivo
```

## Como funciona

1. O app Electron carrega a mesma interface React do sistema web
2. Um `dataProvider` detecta se está no Electron e redireciona chamadas para SQLite local
3. O motor de sync verifica conectividade a cada 60s e sincroniza dados pendentes
4. O agente ControlID faz polling dos leitores na rede local a cada 5s
5. Todos os dados ficam salvos localmente — funciona 100% offline
