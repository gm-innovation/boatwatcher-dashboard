# Dock Check — Servidor Local Dedicado

## Fluxo recomendado

```text
1. Instale o Dock Check Desktop no PC do operador
2. Instale o Dock Check Local Server no servidor local ou no mesmo PC
3. O instalador do servidor cria um app separado (.exe) que roda em background
4. O Desktop aponta para http://localhost:3001 ou para o IP da máquina servidora
5. Se o servidor local ficar indisponível, o Desktop entra em fallback automaticamente
```

## Instalador Windows (.exe)

O projeto agora possui um build dedicado para gerar um instalador separado do servidor local:

```bash
npm install
npm run build:local-server
```

Saída esperada:
- pasta `local-server-dist/`
- instalador `DockCheck-Local-Server-Setup-<versão>.exe`

Esse instalador gera um aplicativo separado chamado **Dock Check Local Server**, com inicialização automática no Windows e execução em background com ícone na bandeja do sistema.

## Dados persistentes

No instalador, os dados não ficam na pasta temporária do app. O runtime usa o diretório do usuário da aplicação para persistir:

- banco SQLite
- uploads locais
- backups automáticos

## Configuração

Variáveis suportadas:

| Variável | Padrão | Descrição |
|---|---|---|
| `BW_HOST` | `0.0.0.0` | Interface HTTP do servidor local |
| `BW_PORT` | `3001` | Porta da API REST |
| `BW_DATA_DIR` | `userData/data` | Diretório do banco SQLite e arquivos |
| `BW_BACKUP_DIR` | `userData/backups` | Diretório de backups automáticos |

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Status do servidor, sync, agent e runtime |
| GET/POST | `/api/workers` | CRUD de trabalhadores |
| GET/POST | `/api/companies` | CRUD de empresas |
| GET/POST | `/api/projects` | CRUD de projetos |
| GET/POST | `/api/access-logs` | Logs de acesso |
| GET/POST | `/api/devices` | Dispositivos ControlID |
| GET/POST | `/api/job-functions` | Funções de trabalho |
| POST | `/api/storage/upload` | Upload de arquivos |
| GET | `/api/sync/status` | Status da sincronização |
| POST | `/api/sync/trigger` | Forçar sincronização |

## Backup

O backup do banco SQLite é feito automaticamente a cada 6 horas, mantendo os 10 backups mais recentes.

## Desktop apontando para o servidor local

No app Desktop, configure a URL do servidor local para um destes cenários:

- mesma máquina: `http://localhost:3001`
- servidor na rede: `http://192.168.1.100:3001`

A URL fica persistida em `server-config.json` no diretório de dados do Desktop.

## Scripts manuais legados

Os scripts `install.bat` e `install.sh` continuam úteis para instalação manual em ambientes de suporte, mas o fluxo principal no Windows agora deve usar o instalador `.exe` dedicado.

