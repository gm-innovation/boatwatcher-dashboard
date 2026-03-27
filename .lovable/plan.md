# Módulo de Visão Industrial — Sistema Separado Integrado

## Arquitetura

```text
┌─────────────────────────┐          ┌──────────────────────────┐
│  MÁQUINA GPU (Python)   │          │  DOCK CHECK (existente)  │
│                         │   REST   │                          │
│  FFmpeg → YOLO → Track  │────────▶│  Local Server (Express)  │
│  ByteTrack              │  events  │  ou Cloud (Edge Fn)      │
│  Regras EPI/Zonas       │◀────────│                          │
│  WebSocket live feed    │  config  │  Desktop / Web (React)   │
│                         │          │  Dashboards CV           │
└─────────────────────────┘          └──────────────────────────┘
```

---

## LADO A — Dentro do Lovable (React + Local Server + Supabase)

### 1. Estrutura de dados
- Migração Supabase: tabelas `cameras`, `zones`, `vision_events`, `flow_audits`, `vision_alerts`
- SQLite local: mesmas tabelas em `electron/database.js`
- Sync Engine: adicionar tabelas ao motor de sincronização existente

### 2. Rotas no Local Server (`server/routes/vision.js`)
- `POST /api/vision/events` — recebe eventos do Vision Server
- `POST /api/vision/heartbeat` — heartbeat/status do Vision Server
- `GET /api/vision/cameras` — CRUD câmeras
- `GET /api/vision/zones` — CRUD zonas
- `GET /api/vision/status` — status consolidado

### 3. Frontend React
- Nova seção "Visão Computacional" no sidebar
- Dashboard de contagem por zona (tempo real via polling)
- Painel de auditoria de fluxo (câmera vs catraca)
- Painel de conformidade EPI
- Modo evacuação (merge onboard + contagem visual)
- Configuração de câmeras e zonas
- Alertas integrados ao sistema de notificações existente

### 4. Edge Function (Supabase)
- `vision-sync` — endpoint para o Vision Server enviar eventos direto à nuvem quando Local Server indisponível

---

## LADO B — Artefato Python (deploy na máquina GPU)

### Estrutura do projeto
```
vision-server/
├── main.py                  # FastAPI app
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── config.yaml              # Câmeras, zonas, conexão com Local Server
├── core/
│   ├── capture.py           # OpenCV + FFmpeg, captura RTSP
│   ├── detector.py          # YOLOv8/v11 inference (GPU)
│   ├── tracker.py           # ByteTrack
│   ├── pose.py              # YOLO-Pose (detecção de quedas)
│   └── preprocessor.py      # Resize, normalização
├── rules/
│   ├── zone_counter.py      # Contagem por zona (polígonos)
│   ├── line_crossing.py     # Cruzamento de linha (entrada/saída)
│   ├── ppe_checker.py       # Detecção de EPI (capacete, colete)
│   ├── loitering.py         # Permanência prolongada
│   ├── anomaly.py           # Trajeto anômalo
│   └── fall_detection.py    # Queda (via pose estimation)
├── integration/
│   ├── dock_check_client.py # Client REST para o Local Server
│   ├── cloud_client.py      # Client direto para Supabase (fallback)
│   └── event_pusher.py      # Fila de eventos com retry
├── api/
│   ├── routes.py            # Endpoints REST (status, config, cameras)
│   └── websocket.py         # WebSocket live feed (contagem, alertas)
├── storage/
│   ├── database.py          # SQLite/PostgreSQL local
│   └── evidence.py          # Snapshots de evidências
└── scripts/
    ├── install.sh
    ├── install.bat
    └── test_camera.py       # Teste de conectividade RTSP
```

### Tecnologias
- Python 3.11+
- FastAPI + Uvicorn
- ultralytics (YOLOv8/v11)
- OpenCV + FFmpeg
- onnxruntime-gpu ou PyTorch
- ByteTrack (implementação Python)
- SQLite ou PostgreSQL

### Funcionalidades
- Captura multi-câmera em threads paralelas
- Inferência YOLO com batch processing
- Tracking persistente por câmera
- Motor de regras configurável por zona
- Push de eventos para Local Server via REST (com retry queue)
- WebSocket para live feed (contagem em tempo real)
- Auto-registro no Local Server (mesmo padrão agent token)
- Armazenamento de evidências (snapshots de incidentes)

---

## Protocolo de Integração

```text
Vision Server                    Local Server
     │                                │
     ├── POST /api/vision/heartbeat ─▶│  (registro + status)
     │                                │
     ├── POST /api/vision/events ────▶│  (contagem, alertas, EPI)
     │                                │
     │◀── GET /api/vision/config ─────┤  (câmeras, zonas, regras)
     │                                │
     ├── WS /ws/live ────────────────▶│  (feed tempo real → frontend)
```

---

## Fases de Implementação

### Fase 1 — Estrutura e Dashboard (Lovable)
- Tabelas Supabase + SQLite
- Rotas de integração no Local Server
- Dashboard frontend com dados simulados
- Config de câmeras e zonas

### Fase 2 — Vision Server Base (Artefato Python)
- FastAPI server com captura RTSP
- YOLO inference + ByteTrack
- Contagem por zona básica
- Push de eventos para Local Server

### Fase 3 — Regras Avançadas
- EPI, loitering, trajeto anômalo, queda
- Auditoria câmera vs catraca
- Alertas e notificações

### Fase 4 — Produção
- Docker packaging
- Modo evacuação
- Relatórios consolidados
- Sync nuvem completo

---

## Arquivos Impactados (Lado Lovable)

| Arquivo | Descrição |
|---|---|
| `electron/database.js` | Novas tabelas SQLite |
| `server/routes/vision.js` | Novo arquivo de rotas |
| `server/index.js` | Registrar rotas de visão |
| `electron/sync.js` | Sync das novas tabelas |
| `src/components/vision/` | Novos componentes de dashboard |
| `src/pages/Vision.tsx` | Nova página |
| `src/components/layouts/AppSidebar.tsx` | Novo item no menu |
| Migração Supabase | Tabelas na nuvem |

## Entregáveis Python

| Artefato | Descrição |
|---|---|
| `vision-server/` | Projeto completo com todos os módulos |
| `Dockerfile` + `docker-compose.yml` | Pronto para deploy GPU |
| Documentação | Setup e configuração |
| Scripts de instalação | Windows + Linux |
