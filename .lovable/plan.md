

## Comparação: Estrutura Ideal vs. Banco Atual

### Tabelas que JÁ EXISTEM (mapeamento direto)

| Entidade ideal | Tabela atual | Status |
|---|---|---|
| Client | `companies` | Existe (api_password, api_environment presentes) |
| Project | `projects` | Existe (api_project_id presente) |
| Device | `devices` | Existe |
| ManagedWorker | `workers` | Existe (code, document_number, photo_url, job_function_id) |
| WorkerDocument | `worker_documents` | Existe (document_type, expiry_date, extracted_data, status) |
| WorkerStrike | `worker_strikes` | Existe |
| ManagedCompany | `companies` | Mesma tabela — empresas terceirizadas e clientes coexistem |
| JobFunction | `job_functions` | Existe |
| DocumentRequirement | `required_documents` | Existe (job_function_id + document_name + is_mandatory) |
| ReportSchedule | `report_schedules` | Existe |
| AppUser (roles) | `user_roles` + `user_companies` + `user_projects` | Existe |

### Tabelas que FALTAM

| Entidade ideal | O que falta | Prioridade |
|---|---|---|
| **WorkerPendingApproval** | Fila de auto-cadastro pendente. Hoje não existe tabela dedicada — o `UserRegistration` na UI usa um fluxo diferente. | Média |
| **CompanyProfile** | O campo `companies` tem dados básicos (CNPJ, contact_email, logo), mas falta: responsável, telefone, endereço. Precisa de colunas extras. | Baixa |
| **CompanyEmployee** | Funcionários cadastrados pela empresa antes de virar `worker`. Não existe. | Média |
| **DocumentType** | Catálogo centralizado de tipos de documento com validade padrão. Hoje `required_documents` tem `document_name` como texto livre — sem tabela de referência. | Alta |
| **Report** | Armazenamento de relatórios gerados (snapshot). Não existe — relatórios são gerados on-the-fly. | Baixa |

### Plano de implementação

#### 1. Criar tabela `document_types` (catálogo de tipos de documento)
```sql
CREATE TABLE public.document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  default_validity_days integer,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
-- SELECT para authenticated, CRUD para admins
```
Alterar `required_documents` para referenciar `document_types.id` em vez de `document_name` texto livre (migração de dados dos nomes existentes).

#### 2. Adicionar colunas ao `companies` (CompanyProfile)
```sql
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS responsible_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text;
```

#### 3. Criar tabela `pending_workers` (WorkerPendingApproval / CompanyEmployee)
Unifica CompanyEmployee e WorkerPendingApproval — funcionários cadastrados por empresas que aguardam aprovação admin para virar `workers`.
```sql
CREATE TABLE public.pending_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  document_number text,
  role text,
  photo_url text,
  submitted_by uuid,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pending_workers ENABLE ROW LEVEL SECURITY;
-- company_admins podem inserir/ver os seus; admins veem todos
```

#### 4. Criar tabela `generated_reports` (Report)
```sql
CREATE TABLE public.generated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  project_id uuid,
  filters jsonb DEFAULT '{}',
  data jsonb,
  file_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Arquivos de código afetados
- `src/types/supabase.ts` — adicionar interfaces para novas tabelas
- `src/components/people/PendingRegistrations.tsx` — conectar à tabela `pending_workers`
- `src/components/people/JobFunctionManagement.tsx` — usar `document_types` em vez de texto livre
- `src/components/settings/CompanyForm.tsx` — campos de responsável, telefone, endereço
- `src/hooks/useDataProvider.ts` / `src/lib/localServerProvider.ts` — providers para novas tabelas

### O que NÃO precisa mudar
- **Client vs Company**: a distinção é feita pelo campo `client_id` em `projects` — não precisa de tabela separada
- **UserRegistration**: já existe fluxo em `src/pages/UserRegistration.tsx` — diferente de WorkerPendingApproval
- **Inmeta**: o sistema já não depende de Inmeta, as credenciais `api_password`/`api_environment` são para ControlID

