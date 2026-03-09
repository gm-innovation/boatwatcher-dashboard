# BoatWatcher — Servidor Local Dedicado

## Arquitetura

```
PC Operador (Electron)  ──LAN──►  Servidor Local (este)  ──Internet──►  Cloud
     thin client                   SQLite + Agent + Sync
```

## Instalação Rápida

### Linux
```bash
cd server/
chmod +x install.sh
./install.sh
```

### Windows
```cmd
cd server\
install.bat
```

## Configuração

Variáveis de ambiente (ou editar `start-server.bat` / systemd service):

| Variável | Padrão | Descrição |
|---|---|---|
| `BW_PORT` | `3001` | Porta da API REST |
| `BW_DATA_DIR` | `./data` | Diretório do banco SQLite e arquivos |
| `BW_BACKUP_DIR` | `./backups` | Diretório de backups automáticos |

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Status do servidor, sync e agent |
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

O backup do banco SQLite é feito automaticamente a cada 6 horas, mantendo os 10 backups mais recentes. Os arquivos ficam em `BW_BACKUP_DIR`.

## No Electron (PC do Operador)

Configure o IP do servidor local no Electron:
- Arquivo `.env` do Electron: `BW_LOCAL_SERVER=http://192.168.1.100:3001`
- Ou via tela de configuração do app
