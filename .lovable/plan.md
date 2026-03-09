

# Revisao Completa do Sistema — Status Atual

## 100% IMPLEMENTADO

| Modulo | Status |
|--------|--------|
| **Autenticacao e RBAC** | Login, setup inicial, roles, RLS em todas as tabelas |
| **Recuperacao de senha** | Link no Login + pagina `/reset-password` com `PASSWORD_RECOVERY` event |
| **Gestao de Clientes** | CRUD completo, logos, CNPJ, email. Sem campos Inmeta na UI |
| **Gestao de Projetos** | Formulario completo com todos os campos |
| **Gestao de Trabalhadores** | CRUD, foto, documentos, strikes, cargos |
| **Dispositivos** | CRUD, comandos via `agent_commands` (status, release, enroll) |
| **Agentes Locais** | Criacao, token, script Python documentado. URL usando env var |
| **Conectividade** | Dashboard integrado na aba Admin |
| **Agent Relay** | Edge Function: poll, result, heartbeat, enriquecimento de comandos |
| **Webhook ControlID** | Recepcao de eventos, notificacao de acesso negado |
| **Tabela `visitors`** | Criada no banco com RLS policies |
| **Pagina Visitantes** | CRUD completo, busca, filtros, checkout. Sem cast `as any` |
| **Relatorios - Presenca** | Dados reais + export PDF |
| **Relatorios - Pernoite** | Dados reais + export PDF |
| **Relatorios - Por Empresa** | Dados reais + export PDF |
| **Relatorios - Conformidade** | Dados reais + export CSV + export PDF |
| **Impressao de Crachas** | `BadgePrinter` integrado no `WorkerDetailsDialog` |
| **Export PDF centralizado** | `exportReportPdf.ts` usado em todos os relatorios |
| **Notificacoes** | Triggers para acesso negado, device offline, docs expirando |
| **RLS `access_logs`** | INSERT restrito a admin (webhook usa service_role) |
| **Remocao Inmeta** | `test-inmeta-connection` deletado, config.toml limpo |
| **URL hardcoded corrigida** | `AgentManagement` usa `VITE_SUPABASE_URL` |
| **RLS `worker_documents`** | Company admins podem inserir docs dos seus trabalhadores |
| **Portal da Empresa - MyWorkers** | Lista trabalhadores, status de docs, upload via `WorkerDocumentsDialog` |
| **Auditoria** | Tabela + painel Admin |
| **Diagnosticos** | Painel com testes de saude |

## PRECISA CORRIGIR / MELHORAR

| Problema | Detalhes | Severidade |
|----------|----------|------------|
| **pg_cron job nao foi criado** | A migration habilitou as extensoes `pg_cron` e `pg_net`, mas o `cron.schedule()` para chamar `check-expiring-documents` diariamente **nunca foi executado**. Falta a migration com o schedule. | **Alto** |
| **Dashboard sem otimizacao mobile real** | O plano mencionava usar `useIsMobile()` nos componentes de dashboard e tabelas, mas nenhum componente (alem do sidebar) usa o hook. Tabelas e cards nao adaptam para mobile. | Medio |
| **Company admins INSERT worker_documents — policies conflitantes** | Ha duas policies INSERT na `worker_documents`: uma restritiva (role `public`, admin only) e outra (role `authenticated`, company_admin). Ambas sao `RESTRICTIVE` (nao `PERMISSIVE`), o que significa que AMBAS precisam passar para o INSERT funcionar. Company admins **nao conseguem inserir** porque a policy admin bloqueia. | **Alto** |
| **Visitors sem checked_out_at no tipo local** | A interface `Visitor` em `Visitors.tsx` nao inclui `checked_out_at`, embora o checkout funcione via mutation direta. Inconsistencia menor de tipagem. | Baixo |

## NAO INICIADO

| Modulo | Descricao |
|--------|-----------|
| **Otimizacao mobile** | Adaptar tabelas (scroll horizontal, colunas ocultas), cards empilhados, formularios responsivos usando `useIsMobile()` |
| **Export PDF do relatorio CompanyReport** | O botao existe mas precisa verificar se esta completo (inline, nao usa `handleExportPdf`) |

---

## Plano de Correcao

### 1. Criar cron job para check-expiring-documents
Migration SQL para agendar execucao diaria as 8h:
```sql
SELECT cron.schedule(
  'check-expiring-docs-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url:=current_setting('app.settings.supabase_url') || '/functions/v1/check-expiring-documents',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || current_setting('app.settings.anon_key')
    ),
    body:='{"scheduled":true}'::jsonb
  );
  $$
);
```

### 2. Corrigir RLS conflitante em worker_documents
As duas policies INSERT sao RESTRICTIVE. Precisa tornar a policy de company_admin PERMISSIVE, ou dropar a policy admin RESTRICTIVE e recriar como PERMISSIVE.

Migration:
```sql
DROP POLICY "Admins can insert worker_documents" ON public.worker_documents;
DROP POLICY "Company admins can insert worker_documents" ON public.worker_documents;

CREATE POLICY "Admins can insert worker_documents" ON public.worker_documents
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Company admins can insert worker_documents" ON public.worker_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers w
      WHERE w.id = worker_id
      AND w.company_id = get_user_company_id(auth.uid())
    )
  );
```
Nota: as policies precisam ser PERMISSIVE (default) para que qualquer uma delas permita o INSERT.

### 3. Adicionar `checked_out_at` ao tipo Visitor
Atualizar a interface em `Visitors.tsx`.

### 4. Otimizacao mobile
Usar `useIsMobile()` nos componentes criticos:
- `WorkersOnBoardTable`: ocultar colunas secundarias no mobile
- `Dashboard`: empilhar cards em coluna unica
- `Visitors`: formulario responsivo
- Tabelas de relatorios: scroll horizontal

**Arquivos:** `Dashboard.tsx`, `WorkersOnBoardTable.tsx`, `Visitors.tsx`, `StatisticsCards.tsx`

### Ordem de execucao
1 → 2 → 3 → 4

Itens 1-3 sao correcoes rapidas. Item 4 e melhoria progressiva.

