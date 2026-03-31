

## Módulo de Controle de Acesso Manual — Mobile/Tablet

### Visão geral

Nova rota `/access-control` com interface mobile-first para registrar entradas/saídas manualmente. Funciona offline com IndexedDB e sincroniza com a nuvem. Acessível por `admin` e nova role `operator`.

O módulo permite configurar "dispositivos virtuais" (pontos de controle manual) com nome, localização (Bordo/Dique) e modo de direção (entrada, saída ou ambos).

### 1. Banco de dados

**Migração SQL:**
```sql
-- Nova role operator
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operator';

-- Tabela de dispositivos virtuais (pontos de controle manual)
CREATE TABLE public.manual_access_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  access_location text NOT NULL DEFAULT 'bordo', -- 'bordo' ou 'dique'
  direction_mode text NOT NULL DEFAULT 'both',   -- 'entry', 'exit', 'both'
  project_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_access_points ENABLE ROW LEVEL SECURITY;

-- RLS: admin e operator podem CRUD
CREATE POLICY "Admin/operator can select manual_access_points"
  ON public.manual_access_points FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Admin/operator can insert manual_access_points"
  ON public.manual_access_points FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Admin/operator can update manual_access_points"
  ON public.manual_access_points FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Admin/operator can delete manual_access_points"
  ON public.manual_access_points FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Atualizar RLS de access_logs para operators poderem inserir
CREATE POLICY "Operators can insert access_logs"
  ON public.access_logs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'operator'::app_role));
```

### 2. Página principal — `src/pages/AccessControl.tsx`

- Layout fullscreen mobile-first (sem sidebar)
- Header: nome do ponto de controle selecionado, indicador online/offline, botão voltar
- **Seletor de ponto de controle** (seleciona um `manual_access_point`)
- Baseado no `direction_mode`:
  - `entry` → mostra apenas botão verde "ENTRADA"
  - `exit` → mostra apenas botão vermelho "SAÍDA"  
  - `both` → tabs ou toggle ENTRADA / SAÍDA
- Exibe localização (Bordo/Dique) como badge

### 3. Identificação do trabalhador

4 métodos de busca no mesmo campo/tela:
- **Campo de texto** — busca por nome, CPF ou código (matrícula)
- **QR Code** — botão abre scanner com seletor de câmera (frontal/traseira) usando `html5-qrcode`
- **Lista scroll** — lista completa dos trabalhadores do projeto para seleção

Ao selecionar o trabalhador → card com foto, nome, empresa, função → botão grande de confirmação

### 4. Componentes

| Componente | Responsabilidade |
|---|---|
| `src/pages/AccessControl.tsx` | Página principal, seleção de ponto de controle |
| `src/components/access-control/AccessPointSelector.tsx` | Seletor/gerenciador dos pontos de controle |
| `src/components/access-control/AccessPointConfig.tsx` | CRUD de pontos: nome, localização, direção |
| `src/components/access-control/WorkerSearch.tsx` | Busca por nome, CPF, código |
| `src/components/access-control/QRScanner.tsx` | Scanner com toggle câmera frontal/traseira |
| `src/components/access-control/WorkerCard.tsx` | Card do trabalhador selecionado |
| `src/components/access-control/AccessConfirmation.tsx` | Botão grande de confirmação (verde/vermelho) |
| `src/components/access-control/OfflineIndicator.tsx` | Status de conexão + pendências |
| `src/components/access-control/RecentAccessList.tsx` | Últimos registros da sessão |

### 5. Offline — `src/hooks/useOfflineAccessControl.ts`

- Carrega trabalhadores do projeto em cache (IndexedDB via `idb-keyval`)
- Logs de acesso salvos em IndexedDB quando offline
- Listener `navigator.onLine` → batch sync automático ao reconectar
- Cada log salvo com: `device_name: "Manual - [nome do ponto]"`, `access_status: 'granted'`

### 6. QR Code no crachá

- Atualizar `BadgePrinter.tsx` para incluir QR Code com o `code` do trabalhador (usar `qrcode.react` para gerar canvas e inserir no PDF)
- Scanner decodifica → busca no cache local pelo `code`
- Toggle de câmera: `html5-qrcode` suporta `facingMode: 'user'` vs `'environment'`

### 7. Roteamento e navegação

- Nova rota `/access-control` em `App.tsx` — protegida para admin e operator
- Link no `AppSidebar.tsx` com ícone `ScanLine` — visível para admin e operator
- `ProtectedRoute` atualizado para aceitar array de roles

### 8. Dependências npm

- `html5-qrcode` — scanner QR via câmera
- `qrcode.react` — gerar QR Code para o crachá
- `idb-keyval` — IndexedDB simplificado

### Sequência de implementação

1. Migração SQL (enum + tabela + RLS)
2. Dependências npm
3. Hook offline + tipos
4. Componentes do módulo (AccessPointConfig, WorkerSearch, QRScanner, etc.)
5. Página AccessControl
6. Roteamento + sidebar
7. Atualizar BadgePrinter com QR Code
8. Atualizar ProtectedRoute para suportar múltiplas roles

