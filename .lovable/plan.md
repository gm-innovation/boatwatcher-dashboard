

# Plano Completo: Finalizar Modulos Parciais e Iniciar Pendentes

## Contexto

O sistema atual tem a infraestrutura base funcional (auth, CRUD de clientes/projetos/trabalhadores, dispositivos, webhook). A direcao agora e eliminar dependencia da API Inmeta e comunicar diretamente com leitores faciais ControlID via agente local.

---

## FASE 1 — Integrar Componentes Existentes Nao Conectados

**Problema:** `AgentManagement` e `ConnectivityDashboard` foram criados mas nao estao acessiveis na UI.

**Acoes:**
- Adicionar abas "Agentes" e "Conectividade" na pagina Admin (`Admin.tsx`)
- Adicionar link "Conectividade" no sidebar (`AppSidebar.tsx`)

**Arquivos:** `src/pages/Admin.tsx`, `src/components/layouts/AppSidebar.tsx`

---

## FASE 2 — Corrigir Relatorios com Dados Mock

**Problema:** `OvernightControl` e `CompanyReport` usam dados hardcoded.

**Acoes:**

### 2.1 OvernightControl (dados reais)
- Consultar `access_logs` agrupando por `worker_id`
- Identificar trabalhadores que entraram mas nao sairam (pernoite = sem exit apos entry)
- Calcular noites consecutivas cruzando com dados historicos
- Join com `workers` e `companies` para nome e empresa

### 2.2 CompanyReport (dados reais)
- Consultar `access_logs` com join em `workers` e `companies`
- Agrupar por empresa: total trabalhadores, total horas, total entradas
- Calcular horas reais (diferenca entry/exit)

**Arquivos:** `src/components/reports/OvernightControl.tsx`, `src/components/reports/CompanyReport.tsx`

---

## FASE 3 — Remover Dependencia da Inmeta

**Problema:** Campos `contact_email`, `api_password`, `api_environment` nos clientes e a Edge Function `test-inmeta-connection` sao voltados para API Inmeta.

**Acoes:**
- Remover secao "Configuracoes da API Inmeta" do formulario de clientes
- Remover Edge Function `test-inmeta-connection`
- Manter campos no banco (sem breaking change), apenas ocultar da UI
- Renomear referencias visuais de "ControlID" para "Dispositivos" onde apropriado

**Arquivos:** `src/components/admin/ClientsManagement.tsx`

---

## FASE 4 — Fortalecer Comunicacao Direta com Dispositivos

**Problema:** O `controlid-api` Edge Function tenta conectar diretamente ao IP do dispositivo, mas dispositivos estao em rede local (inacessivel pela cloud). O `agent-relay` ja resolve isso parcialmente.

**Acoes:**

### 4.1 Melhorar Agent Relay
- Adicionar comando `sync_users` para sincronizar lista de trabalhadores do banco para o dispositivo
- Adicionar comando `get_status` para verificar status em tempo real
- Adicionar comando `capture_photo` para captura de foto facial

### 4.2 Criar fluxo de Enrollment via Agente
- Quando admin faz enrollment de trabalhador, criar `agent_command` com tipo `enroll_user`
- Payload inclui: worker_id, name, photo_url
- Agente local recebe, faz a chamada HTTP ao dispositivo na rede local
- Agente retorna resultado via `/result`

### 4.3 Atualizar DeviceManagement
- Botao "Status" envia comando via agent_command ao inves de chamar controlid-api direto
- Botao "Liberar" envia comando `release_access` via agente
- Mostrar feedback de comandos pendentes/executados

### 4.4 Script do Agente Local (documentacao melhorada)
- Atualizar `AgentManagement.tsx` com script Python mais completo
- Incluir tratamento de erros, retry, logs
- Suportar comandos: `enroll_user`, `remove_user`, `release_access`, `get_status`, `sync_users`

**Arquivos:** `supabase/functions/agent-relay/index.ts`, `src/components/devices/DeviceManagement.tsx`, `src/hooks/useControlID.ts`, `src/components/devices/AgentManagement.tsx`

---

## FASE 5 — Notificacoes Automaticas

**Problema:** Sistema de notificacoes existe mas nao ha triggers automaticos.

**Acoes:**

### 5.1 Trigger de documento expirando
- Criar DB trigger ou cron job (via `check-expiring-documents` Edge Function)
- Quando documento esta a 30/15/7 dias de expirar, inserir notificacao para admins
- Marcar trabalhador como `pending_review` se documento expirou

### 5.2 Trigger de acesso negado
- No webhook `controlid-webhook`, apos registrar acesso negado, inserir notificacao
- Prioridade `high` para acessos bloqueados

### 5.3 Trigger de dispositivo offline
- No heartbeat do agente, se dispositivo estava online e ficou offline, criar notificacao

**Arquivos:** `supabase/functions/check-expiring-documents/index.ts`, `supabase/functions/controlid-webhook/index.ts`, `supabase/functions/agent-relay/index.ts`

---

## FASE 6 — Recuperacao de Senha

**Problema:** Login nao tem opcao "Esqueci minha senha".

**Acoes:**
- Adicionar link "Esqueceu a senha?" na tela de login
- Usar `supabase.auth.resetPasswordForEmail()`
- Criar pagina `/reset-password` para definir nova senha
- Usar `supabase.auth.updateUser({ password })` apos redirect

**Arquivos:** `src/pages/Login.tsx`, `src/pages/ResetPassword.tsx` (novo), `src/App.tsx`

---

## FASE 7 — Controle de Visitantes

**Problema:** `useVisitorDetection.ts` existe mas sem UI dedicada.

**Acoes:**
- Criar pagina/aba "Visitantes" no menu principal
- Formulario de cadastro rapido de visitante (nome, documento, empresa, motivo, validade)
- Criar tabela `visitors` no banco (name, document, company, reason, valid_until, photo_url, status)
- Visitante aprovado gera enrollment temporario nos dispositivos
- Dashboard de visitantes ativos com timer de validade

**Arquivos:** Migration SQL, `src/pages/Visitors.tsx` (novo), `src/components/visitors/*` (novos), `src/App.tsx`

---

## Resumo de Prioridades

| Fase | Esforco | Impacto |
|------|---------|---------|
| 1. Integrar componentes existentes | Baixo | Medio |
| 2. Corrigir relatorios mock | Medio | Alto |
| 3. Remover Inmeta | Baixo | Medio |
| 4. Comunicacao direta dispositivos | Alto | Critico |
| 5. Notificacoes automaticas | Medio | Alto |
| 6. Recuperacao de senha | Baixo | Medio |
| 7. Controle de visitantes | Alto | Medio |

**Recomendacao:** Executar na ordem 1 → 3 → 2 → 4 → 6 → 5 → 7

