

# Auditoria Final — Pendencias Criticas e Melhorias

## Situacao Atual

O scan de seguranca revelou **14 vulnerabilidades**, sendo 5 de severidade **ERROR** (critica). Alem disso, ha redundancias de codigo e um componente Header legado que faz queries duplicadas ao banco.

---

## CORRECOES CRITICAS DE SEGURANCA (5 ERRORs)

### 1. `worker_documents` acessivel por usuarios anonimos
A policy SELECT aplica-se a `{public}` com `USING (true)`. Qualquer pessoa sem login pode ler todos os documentos de trabalhadores.

**Fix:** Dropar policy e recriar para `{authenticated}` com escopo por role/empresa.

### 2. Dados biometricos de `workers` legiveis por todos autenticados
A policy SELECT usa `USING (true)` para `{authenticated}`. Qualquer usuario logado le `facial_template_data`, `document_number`, `birth_date`, etc.

**Fix:** Restringir SELECT a admins e company_admins (para seus trabalhadores).

### 3. `companies` expoe `api_password` para todos autenticados
Qualquer usuario logado pode ler credenciais API de todas as empresas.

**Fix:** Restringir SELECT sensivel a admins. Company_admins so veem a propria empresa.

### 4. `devices` expoe credenciais e IPs para todos autenticados
`api_credentials`, `controlid_ip_address`, `controlid_serial_number` legiveis por qualquer usuario.

**Fix:** Restringir a admins.

### 5. `audit_logs` INSERT aberto para `{public}`
Qualquer pessoa pode inserir entradas falsas no log de auditoria sem autenticacao.

**Fix:** Restringir INSERT a `{authenticated}` ou apenas admins/service_role.

## CORRECOES DE SEGURANCA (WARNINGs)

### 6. `worker_strikes` acessivel por anonimos
Policy SELECT para `{public}`. Registros disciplinares sem autenticacao.

### 7. `system_settings` legivel por anonimos
Configuracoes do sistema (thresholds, timings) expostas.

### 8. `notifications` INSERT aberto para `{public}`
Qualquer pessoa pode enviar notificacoes para qualquer usuario.

### 9. `visitors` e `access_logs` legiveis por todos autenticados
Dados pessoais sem restricao por projeto.

### 10. Leaked password protection desabilitada
Configuracao de auth do projeto.

---

## MELHORIAS DE CODIGO

### 11. Header.tsx faz query de role duplicada
`Header.tsx` (linha 34-46) faz `supabase.from('user_roles').select(...)` independentemente, duplicando o que `AuthContext` ja fornece. Deve usar `useAuthContext()` ao inves de query direta.

### 12. Header.tsx faz logout independente
`handleLogout` (linha 52-63) chama `supabase.auth.signOut()` diretamente. Deveria usar `signOut` do `AuthContext` para consistencia.

---

## PLANO DE EXECUCAO

### Migration SQL unica para corrigir todas as RLS policies:

```sql
-- 1. worker_documents: trocar public por authenticated + escopo
DROP POLICY IF EXISTS "Anyone can view worker_documents" ON public.worker_documents;
CREATE POLICY "Admins can view all worker_documents" ON public.worker_documents
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Company admins view own worker_documents" ON public.worker_documents
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workers w WHERE w.id = worker_id
    AND w.company_id = get_user_company_id(auth.uid())
  ));

-- 2. workers: restringir SELECT
DROP POLICY IF EXISTS "Authenticated users can view workers" ON public.workers;
CREATE POLICY "Admins can view all workers" ON public.workers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Company admins view own workers" ON public.workers
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

-- 3. companies: restringir SELECT
DROP POLICY IF EXISTS "Authenticated can view companies" ON public.companies;
CREATE POLICY "Admins can view all companies" ON public.companies
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Company admins view own company" ON public.companies
  FOR SELECT TO authenticated
  USING (id = get_user_company_id(auth.uid()));

-- 4. devices: restringir a admin
DROP POLICY IF EXISTS "Authenticated can view devices" ON public.devices;
CREATE POLICY "Admins can view devices" ON public.devices
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. audit_logs: restringir INSERT
DROP POLICY IF EXISTS "System can insert audit_logs" ON public.audit_logs;
CREATE POLICY "Authenticated can insert audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- 6. worker_strikes: trocar public por authenticated
DROP POLICY IF EXISTS "Anyone can view worker_strikes" ON public.worker_strikes;
CREATE POLICY "Admins can view worker_strikes" ON public.worker_strikes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 7. system_settings: trocar public por authenticated
DROP POLICY IF EXISTS "Anyone can view system_settings" ON public.system_settings;
CREATE POLICY "Authenticated can view system_settings" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

-- 8. notifications INSERT: trocar public por authenticated
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);
```

### Codigo — Header.tsx usa AuthContext

Remover a query de role manual (linhas 34-46) e o `handleLogout` manual. Substituir por:
```typescript
const { role, signOut } = useAuthContext();
const isAdmin = role === 'admin';
const isCompanyAdmin = role === 'company_admin';
```

### Habilitar leaked password protection
Usar a ferramenta de configuracao de auth.

---

## Ordem de Execucao

| Passo | Item | Severidade |
|-------|------|------------|
| 1 | Migration RLS (todos os fixes acima) | CRITICA |
| 2 | Header.tsx usar AuthContext | Media |
| 3 | Leaked password protection | Baixa |

**Arquivos modificados:** `src/components/Header.tsx`, 1 migration SQL nova.

