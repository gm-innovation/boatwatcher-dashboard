

# Modo Offline Completo com Instalador Desktop

## O problema
Você quer que o sistema offline tenha **exatamente** a mesma interface que o sistema web (Dashboard, Relatórios, Gestão de Pessoas, impressão de crachás), rodando como um aplicativo instalado no servidor local, sem precisar acessar via URL.

## A solução: Electron

**Electron** permite empacotar a aplicação React atual como um aplicativo desktop instalável (.exe no Windows, .deb/.AppImage no Linux). O usuário clica no ícone e o sistema abre, igual a qualquer programa.

```text
┌─────────────────────────────────────────────────┐
│              Servidor Local (PC)                │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │  BoatWatcher Desktop (Electron)           │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  Mesma interface React              │  │  │
│  │  │  Dashboard / Relatórios / Pessoas   │  │  │
│  │  │  Impressão de crachás               │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  │                                           │  │
│  │  SQLite local (dados offline)             │  │
│  │  Agente ControlID embutido (polling)      │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Leitor ControlID (rede local) ◄────────────┘   │
└──────────────────────┬──────────────────────────┘
                       │ quando há internet
                       ▼
                 ┌───────────┐
                 │   Cloud   │  (backup + acesso remoto)
                 └───────────┘
```

## Como funciona

**Offline**: O app usa SQLite local como banco de dados. Todas as operações (cadastro, dashboard, relatórios, crachás) funcionam normalmente. O agente ControlID roda embutido.

**Online**: Sincroniza automaticamente com o cloud. Dados novos sobem, atualizações descem. O sistema web continua funcionando em paralelo.

**Instalador**: Gera um `.exe` (Windows) ou `.AppImage` (Linux) que instala com um clique. Abre como "BoatWatcher" no menu iniciar.

## Limitação importante do Lovable

**O Lovable não consegue gerar o instalador Electron diretamente.** O Lovable é uma plataforma para aplicações web. O que podemos fazer aqui:

1. **Preparar o código-fonte** para funcionar tanto em modo web quanto desktop
2. **Criar a camada de abstração** de dados (SQLite local vs Cloud)
3. **Criar os arquivos Electron** (main.js, preload.js, configuração do builder)
4. **Gerar o script de build** que o desenvolvedor roda localmente para criar o instalador

O build final do `.exe` precisa ser executado em uma máquina local com Node.js instalado (`npm run build:electron`).

## Plano de implementação

### Etapa 1: Camada de abstração de dados
Criar um "data provider" que detecta se está rodando no Electron ou no navegador:
- **Navegador**: usa Supabase normalmente
- **Electron**: usa SQLite local via `better-sqlite3`

Arquivo: `src/lib/dataProvider.ts` — interface unificada para CRUD de workers, companies, access_logs, etc.

### Etapa 2: Arquivos Electron
- `electron/main.js` — processo principal, janela do app
- `electron/preload.js` — bridge entre Node.js e renderer
- `electron/database.js` — gerenciador SQLite local
- `electron/sync.js` — motor de sync bidirecional com cloud
- `electron/agent.js` — polling dos leitores ControlID (substitui o script Python)

### Etapa 3: Configuração do Builder
- `electron-builder.yml` — configuração para gerar instalador Windows/Linux
- Scripts no `package.json`: `build:electron`, `start:electron`

### Etapa 4: Atualizar componentes React
- Substituir chamadas diretas ao Supabase pelo data provider
- Adicionar indicador de status online/offline no Header
- Adicionar tela de configuração local (IP dos leitores, intervalo de sync)

## Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `electron/main.js` | Criar — processo principal Electron |
| `electron/preload.js` | Criar — bridge segura |
| `electron/database.js` | Criar — SQLite local |
| `electron/sync.js` | Criar — sync bidirecional |
| `electron/agent.js` | Criar — polling ControlID |
| `electron-builder.yml` | Criar — config do instalador |
| `src/lib/dataProvider.ts` | Criar — abstração web/desktop |
| `src/components/Header.tsx` | Editar — indicador online/offline |
| `package.json` | Editar — scripts electron |

## Observação
Esta é uma mudança arquitetural significativa. Recomendo implementar em fases, começando pela camada de abstração de dados e arquivos Electron básicos, depois evoluindo para a sync bidirecional.

