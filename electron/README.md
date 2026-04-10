# Dock Check Desktop — Build Instructions

## ⚠️ IMPORTANTE

**NUNCA abra arquivos `.js` diretamente pelo Windows Explorer.**
Use sempre o app instalado ou os scripts de build/dev descritos abaixo.

## Pré-requisitos

- Node.js 20 LTS
- npm

## Setup

```bash
npm install
```

## Desenvolvimento

```bash
# App web
npm run dev

# Desktop com servidor local em desenvolvimento
npm run desktop:dev
```

## Build do Desktop

```bash
npm run build:electron
```

Saída:
- `electron-dist/`
- instalador do **Dock Check Desktop**

## Build do servidor local separado

```bash
npm run build:local-server
```

Saída:
- `local-server-dist/`
- instalador do **Dock Check Local Server**

Esse build gera um app separado, próprio para a máquina servidora/local, executando o servidor em background e inicializando com o Windows.

## Arquitetura atual

```text
Dock Check Desktop        -> cliente do operador
Dock Check Local Server   -> API local + SQLite + Agent + Sync
Lovable Cloud             -> autenticação + sincronização + fallback
```

## Como funciona

1. O operador usa o Desktop normalmente
2. O Desktop lê a URL salva em `server-config.json`
3. Quando o servidor local responde, o Desktop opera em modo local
4. Quando ele não responde, o Desktop entra em fallback automaticamente
5. O servidor local pode estar na mesma máquina (`localhost`) ou em outro IP da rede

## Configuração de conexão do Desktop

Exemplos de URL do servidor local:

- mesma máquina: `http://localhost:3001`
- servidor dedicado na rede: `http://192.168.1.100:3001`

## Troubleshooting

| Problema | Solução |
|---|---|
| Erro "Windows Script Host" | Não abra `.js` pelo Explorer. Use o app instalado. |
| Tela branca no Desktop | Verifique `base: './'` no vite.config.ts |
| Servidor não conecta | Confirme que o Local Server está rodando na porta 3001 |
