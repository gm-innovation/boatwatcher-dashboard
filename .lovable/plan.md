

# Plano de Execucao: Correcoes, Melhorias e Novos Modulos

## 1. Criar tabela `visitors` no banco (CRITICO)

Migration SQL:
```sql
CREATE TABLE public.visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document_number text,
  company text,
  reason text,
  valid_until timestamptz,
  photo_url text,
  status text NOT NULL DEFAULT 'active',
  project_id uuid REFERENCES public.projects(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  checked_out_at timestamptz
);

ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access visitors" ON public.visitors FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view visitors" ON public.visitors FOR SELECT TO authenticated
  USING (true);
```

Depois: remover o cast `(supabase.from as any)` do `Visitors.tsx` e usar tipagem correta apos regeneracao dos types.

## 2. Remover `test-inmeta-connection`

- Deletar arquivo `supabase/functions/test-inmeta-connection/index.ts`
- Remover entrada `[functions.test-inmeta-connection]` do `supabase/config.toml`

## 3. Corrigir URL hardcoded no `AgentManagement.tsx`

Linha 33: trocar de:
```typescript
const AGENT_RELAY_URL = `https://qdscawiwjhzgiqroqkik.supabase.co/functions/v1/agent-relay`;
```
Para:
```typescript
const AGENT_RELAY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-relay`;
```

## 4. Restringir INSERT policy de `access_logs`

Migration para dropar a policy permissiva e criar uma restritiva:
```sql
DROP POLICY "System can insert access_logs" ON public.access_logs;
CREATE POLICY "Only admins can insert access_logs" ON public.access_logs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```
O webhook usa `service_role` que bypassa RLS, entao continua funcionando.

## 5. Agendar `check-expiring-documents` via pg_cron

Habilitar extensoes `pg_cron` e `pg_net`, criar job diario:
```sql
SELECT cron.schedule(
  'check-expiring-docs-daily',
  '0 8 * * *',
  $$ SELECT net.http_post(
    url:='https://qdscawiwjhzgiqroqkik.supabase.co/functions/v1/check-expiring-documents',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer ANON_KEY"}'::jsonb,
    body:='{"time":"now"}'::jsonb
  ) as request_id; $$
);
```

## 6. Adicionar export PDF ao ComplianceReport

Usar `jspdf` (ja instalado) para gerar PDF formatado com cabecalho, tabela de documentos vencidos/vencendo. Adicionar botao "Exportar PDF" ao lado do "Exportar CSV" existente.

**Arquivo:** `src/components/reports/ComplianceReport.tsx`

## 7. Upload de documentos pelo Portal da Empresa

Permitir `company_admin` fazer upload de documentos de trabalhadores da sua empresa. Adicionar botao de upload no `MyWorkers.tsx` que usa o bucket `worker-documents`. Ajustar RLS de `worker_documents` para permitir INSERT por `company_admin` quando o worker pertence a sua empresa.

Migration:
```sql
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

**Arquivo:** `src/components/company-portal/MyWorkers.tsx`

## 8. Sistema de impressao de crachas

Criar componente `BadgePrinter.tsx` usando jspdf:
- Layout: foto do trabalhador, nome, empresa, cargo, QR code com worker ID
- Logo do cliente (light/dark)
- Botao "Imprimir Cracha" no detalhe do trabalhador (`WorkerDetailsDialog`)

**Arquivos:** `src/components/workers/BadgePrinter.tsx` (novo), `src/components/workers/WorkerDetailsDialog.tsx`

## 9. Export PDF para todos os relatorios

Criar util `src/utils/exportReportPdf.ts` com funcao generica que recebe titulo, colunas e dados. Integrar nos relatorios de Presenca, Pernoite e Empresa.

**Arquivos:** `src/utils/exportReportPdf.ts` (novo), `OvernightControl.tsx`, `PresenceReport.tsx`, `CompanyReport.tsx`

## 10. Otimizacao mobile

Revisar componentes criticos usando `useIsMobile()`:
- Sidebar: ja usa sheet no mobile (ok)
- Tabelas: adicionar scroll horizontal e reduzir colunas visiveis
- Dashboard: empilhar cards em coluna unica
- Visitantes: formulario responsivo

**Arquivos:** componentes de tabela e dashboard

---

## Ordem de execucao

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

Itens 1-4 sao correcoes rapidas. Item 5 e automacao. Itens 6-10 sao melhorias progressivas.

