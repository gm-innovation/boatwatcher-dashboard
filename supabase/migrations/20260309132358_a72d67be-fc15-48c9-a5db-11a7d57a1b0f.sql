-- 1. worker_documents: fix SELECT from {public} to {authenticated} with role scoping
DROP POLICY IF EXISTS "Authenticated users can view worker_documents" ON public.worker_documents;
CREATE POLICY "Admins can view all worker_documents" ON public.worker_documents
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Company admins view own worker_documents" ON public.worker_documents
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workers w WHERE w.id = worker_documents.worker_id
    AND w.company_id = get_user_company_id(auth.uid())
  ));

-- 2. workers: restrict SELECT to admins + company_admins for own workers
DROP POLICY IF EXISTS "Authenticated users can view workers" ON public.workers;
CREATE POLICY "Admins can view all workers" ON public.workers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Company admins view own workers" ON public.workers
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

-- 3. companies: restrict SELECT to admins + own company
DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.companies;
CREATE POLICY "Admins can view all companies" ON public.companies
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Company admins view own company" ON public.companies
  FOR SELECT TO authenticated
  USING (id = get_user_company_id(auth.uid()));

-- 4. devices: restrict SELECT to admin only
DROP POLICY IF EXISTS "Authenticated users can view devices" ON public.devices;
CREATE POLICY "Only admins can view devices" ON public.devices
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. audit_logs: restrict INSERT from {public} to {authenticated}
DROP POLICY IF EXISTS "System can insert audit_logs" ON public.audit_logs;
CREATE POLICY "Authenticated can insert audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- 6. worker_strikes: fix from {public} to {authenticated} with scoping
DROP POLICY IF EXISTS "Authenticated users can view worker_strikes" ON public.worker_strikes;
CREATE POLICY "Admins can view all worker_strikes" ON public.worker_strikes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Company admins view own worker_strikes" ON public.worker_strikes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workers w WHERE w.id = worker_strikes.worker_id
    AND w.company_id = get_user_company_id(auth.uid())
  ));

-- 7. system_settings: fix SELECT from {public} to {authenticated}
DROP POLICY IF EXISTS "Authenticated users can view system_settings" ON public.system_settings;
CREATE POLICY "Authenticated can view system_settings" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

-- 8. notifications: fix INSERT from {public} to {authenticated}
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- 9. Fix remaining {public} role policies to {authenticated}
-- worker_documents write ops
DROP POLICY IF EXISTS "Admins can delete worker_documents" ON public.worker_documents;
CREATE POLICY "Admins can delete worker_documents" ON public.worker_documents
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update worker_documents" ON public.worker_documents;
CREATE POLICY "Admins can update worker_documents" ON public.worker_documents
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- worker_strikes write ops
DROP POLICY IF EXISTS "Admins can delete worker_strikes" ON public.worker_strikes;
CREATE POLICY "Admins can delete worker_strikes" ON public.worker_strikes
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can insert worker_strikes" ON public.worker_strikes;
CREATE POLICY "Admins can insert worker_strikes" ON public.worker_strikes
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update worker_strikes" ON public.worker_strikes;
CREATE POLICY "Admins can update worker_strikes" ON public.worker_strikes
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- system_settings write ops
DROP POLICY IF EXISTS "Admins can delete system_settings" ON public.system_settings;
CREATE POLICY "Admins can delete system_settings" ON public.system_settings
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can insert system_settings" ON public.system_settings;
CREATE POLICY "Admins can insert system_settings" ON public.system_settings
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update system_settings" ON public.system_settings;
CREATE POLICY "Admins can update system_settings" ON public.system_settings
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- notifications write ops
DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;
CREATE POLICY "Admins can delete notifications" ON public.notifications
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT TO authenticated USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- company_documents fix {public} to {authenticated}
DROP POLICY IF EXISTS "Company admins can delete documents" ON public.company_documents;
CREATE POLICY "Company admins can delete documents" ON public.company_documents
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR (company_id = get_user_company_id(auth.uid())));
DROP POLICY IF EXISTS "Company admins can insert documents" ON public.company_documents;
CREATE POLICY "Company admins can insert documents" ON public.company_documents
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR (company_id = get_user_company_id(auth.uid())));
DROP POLICY IF EXISTS "Users can view their company documents" ON public.company_documents;
CREATE POLICY "Users can view their company documents" ON public.company_documents
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR (company_id = get_user_company_id(auth.uid())));

-- job_functions fix {public} to {authenticated}
DROP POLICY IF EXISTS "Admins can delete job_functions" ON public.job_functions;
CREATE POLICY "Admins can delete job_functions" ON public.job_functions
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can insert job_functions" ON public.job_functions;
CREATE POLICY "Admins can insert job_functions" ON public.job_functions
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update job_functions" ON public.job_functions;
CREATE POLICY "Admins can update job_functions" ON public.job_functions
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Authenticated users can view job_functions" ON public.job_functions;
CREATE POLICY "Authenticated can view job_functions" ON public.job_functions
  FOR SELECT TO authenticated USING (true);

-- required_documents fix {public} to {authenticated}
DROP POLICY IF EXISTS "Admins can delete required_documents" ON public.required_documents;
CREATE POLICY "Admins can delete required_documents" ON public.required_documents
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can insert required_documents" ON public.required_documents;
CREATE POLICY "Admins can insert required_documents" ON public.required_documents
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update required_documents" ON public.required_documents;
CREATE POLICY "Admins can update required_documents" ON public.required_documents
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Authenticated users can view required_documents" ON public.required_documents;
CREATE POLICY "Authenticated can view required_documents" ON public.required_documents
  FOR SELECT TO authenticated USING (true);

-- report_schedules fix {public} to {authenticated}
DROP POLICY IF EXISTS "Admins can delete report_schedules" ON public.report_schedules;
CREATE POLICY "Admins can delete report_schedules" ON public.report_schedules
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can insert report_schedules" ON public.report_schedules;
CREATE POLICY "Admins can insert report_schedules" ON public.report_schedules
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update report_schedules" ON public.report_schedules;
CREATE POLICY "Admins can update report_schedules" ON public.report_schedules
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can view report_schedules" ON public.report_schedules;
CREATE POLICY "Admins can view report_schedules" ON public.report_schedules
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- agent_commands fix {public} to {authenticated}
DROP POLICY IF EXISTS "Admins can delete agent_commands" ON public.agent_commands;
CREATE POLICY "Admins can delete agent_commands" ON public.agent_commands
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can insert agent_commands" ON public.agent_commands;
CREATE POLICY "Admins can insert agent_commands" ON public.agent_commands
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update agent_commands" ON public.agent_commands;
CREATE POLICY "Admins can update agent_commands" ON public.agent_commands
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can view agent_commands" ON public.agent_commands;
CREATE POLICY "Admins can view agent_commands" ON public.agent_commands
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- local_agents fix {public} to {authenticated}
DROP POLICY IF EXISTS "Admins can delete local_agents" ON public.local_agents;
CREATE POLICY "Admins can delete local_agents" ON public.local_agents
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can insert local_agents" ON public.local_agents;
CREATE POLICY "Admins can insert local_agents" ON public.local_agents
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update local_agents" ON public.local_agents;
CREATE POLICY "Admins can update local_agents" ON public.local_agents
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can view local_agents" ON public.local_agents;
CREATE POLICY "Admins can view local_agents" ON public.local_agents
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- device_api_tokens fix {public} to {authenticated}
DROP POLICY IF EXISTS "Admins can delete device_api_tokens" ON public.device_api_tokens;
CREATE POLICY "Admins can delete device_api_tokens" ON public.device_api_tokens
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can insert device_api_tokens" ON public.device_api_tokens;
CREATE POLICY "Admins can insert device_api_tokens" ON public.device_api_tokens
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update device_api_tokens" ON public.device_api_tokens;
CREATE POLICY "Admins can update device_api_tokens" ON public.device_api_tokens
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can view device_api_tokens" ON public.device_api_tokens;
CREATE POLICY "Admins can view device_api_tokens" ON public.device_api_tokens
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- user_companies fix {public} to {authenticated}
DROP POLICY IF EXISTS "Admins can delete user_companies" ON public.user_companies;
CREATE POLICY "Admins can delete user_companies" ON public.user_companies
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can insert user_companies" ON public.user_companies;
CREATE POLICY "Admins can insert user_companies" ON public.user_companies
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update user_companies" ON public.user_companies;
CREATE POLICY "Admins can update user_companies" ON public.user_companies
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Users can view their own company associations" ON public.user_companies;
CREATE POLICY "Users can view their own company associations" ON public.user_companies
  FOR SELECT TO authenticated USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));