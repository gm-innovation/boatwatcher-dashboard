

# Renomear "BoatWatcher" para "Dock Check" + Status do Projeto

## O que falta

O sistema ja tem toda a estrutura implementada:
- Frontend React com modo hibrido (Web/Electron)
- Servidor local dedicado com API REST, backup e sync
- Electron como thin client
- Auth com bypass offline

**Pendencias reais para producao:**
1. **Renomear tudo de "BoatWatcher" para "Dock Check"** — 11 arquivos ainda usam o nome errado
2. **Testar o fluxo web end-to-end** — garantir que as adaptacoes hibridas nao quebraram nada
3. **Guia de deploy completo** — instrucoes para instalar servidor local + Electron nos PCs
4. **Tela de configuracao do servidor local no Electron** — para o operador definir IP/porta
5. **Indicador de sync real no Header** — mostrar status de conexao com servidor local e cloud

## Plano imediato: Renomear para "Dock Check"

Substituir todas as 103 ocorrencias de "BoatWatcher"/"boatwatcher" nos seguintes arquivos:

| Arquivo | Mudanca |
|---|---|
| `index.html` | title: "Dock Check" |
| `electron-builder.yml` | appId: `com.dockcheck.desktop`, productName: "Dock Check Desktop", shortcutName: "Dock Check" |
| `electron/main.js` | title: "Dock Check Desktop" |
| `electron/database.js` | dbPath: `dockcheck.db` |
| `electron/README.md` | Titulo e nomes de arquivo |
| `server/index.js` | Logs: `[Dock Check Server]` |
| `server/package.json` | name: `dockcheck-local-server` |
| `server/README.md` | Titulo |
| `server/backup.js` | Nomes de arquivo de backup: `dockcheck-*.db` |
| `server/install.sh` | Service name: `dockcheck-server`, mensagens |
| `server/install.bat` | Service name: `DockCheckServer`, mensagens |

Total: 11 arquivos, ~103 substituicoes. Nenhuma mudanca de logica — apenas branding.

