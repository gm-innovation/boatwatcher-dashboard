

# Adaptacao Frontend para Modo Hibrido (Etapa 4)

## Situacao Atual

Sim, o sistema funcionara local e web **simultaneamente**:
- **Web**: React + Cloud (como esta hoje)
- **Local (Electron)**: Mesma interface React + SQLite local + sync automatico

A ponte entre os dois ja existe parcialmente: `electron/sync.js` sincroniza com o cloud via `agent-sync` edge function. Porem, **40 arquivos React** ainda importam o client cloud diretamente. No Electron, essas chamadas falhariam. Precisamos adaptar o frontend.

## O que falta

### 1. Hook universal `useDataProvider.ts`
Cria um wrapper que detecta o ambiente:
- **Web**: delega para o client cloud normalmente
- **Electron**: delega para `window.electronAPI.db` (SQLite via IPC)

### 2. Adaptar `useSupabase.ts` (hook principal de dados)
As funcoes `useCompanies`, `useWorkers`, `useProjects`, `useWorkersOnBoard` passam a usar o data provider. No modo Electron, chamam SQLite local; na web, continuam usando cloud.

### 3. Adaptar `useControlID.ts` (dispositivos e logs)
`useDevices`, `useAccessLogs` e mutations de dispositivos precisam funcionar via SQLite local no Electron.

### 4. Auth offline em `AuthContext.tsx` + `ProtectedRoute.tsx`
No Electron, nao ha login cloud. Criar um bypass: usuario local com role `admin` automatico, sem autenticacao remota.

### 5. Adaptar componentes com chamadas diretas (CRUD)
Os 40 arquivos que importam o client diretamente precisam ser adaptados. Os principais:
- `CompanyManagement.tsx`, `PendingRegistrations.tsx` — CRUD de empresas/workers
- `WorkerDetailsDialog.tsx`, `WorkerManagement.tsx` — gestao de trabalhadores  
- `CompanyForm.tsx`, `ProjectForm.tsx` — formularios de configuracao
- `RecentActivityFeed.tsx` — realtime (no Electron usa polling local)
- `OvernightControl.tsx`, `CompanyReports.tsx` — relatorios

### 6. Tratamento de Storage (fotos/documentos)
No Electron, fotos e documentos sao salvos no filesystem local em vez do cloud storage. Criar um `storageProvider` similar ao dataProvider.

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/hooks/useDataProvider.ts` | Criar — hook que abstrai cloud vs SQLite |
| `src/lib/storageProvider.ts` | Criar — abstrai cloud storage vs filesystem |
| `src/hooks/useSupabase.ts` | Editar — usar data provider |
| `src/hooks/useControlID.ts` | Editar — usar data provider |
| `src/contexts/AuthContext.tsx` | Editar — bypass auth no Electron |
| `src/hooks/useAuth.tsx` | Editar — modo offline sem login cloud |
| `src/components/ProtectedRoute.tsx` | Editar — permitir acesso offline |
| `src/components/people/CompanyManagement.tsx` | Editar — usar data provider |
| `src/components/people/PendingRegistrations.tsx` | Editar — usar data provider |
| `src/components/workers/WorkerDetailsDialog.tsx` | Editar — usar data provider |
| `src/components/settings/CompanyForm.tsx` | Editar — usar data provider |
| `src/components/settings/ProjectForm.tsx` | Editar — usar data provider |
| `src/components/dashboard/RecentActivityFeed.tsx` | Editar — polling local no Electron |
| `src/components/reports/OvernightControl.tsx` | Editar — usar data provider |
| `src/components/Header.tsx` | Editar — integrar indicador sync real |
| `electron/database.js` | Editar — adicionar metodos faltantes para todos os CRUDs |
| `electron/preload.js` | Editar — expor metodos adicionais de CRUD |

**Nota**: A versao web nao sera afetada — todas as mudancas sao condicionais (`isElectron()`). No navegador, o comportamento atual e preservado integralmente.

