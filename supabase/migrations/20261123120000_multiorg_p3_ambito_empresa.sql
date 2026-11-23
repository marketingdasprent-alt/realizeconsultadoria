-- Multi-organização, PR3: âmbito por empresa nas tabelas de dados.
--
-- Problema: as regras de dados dizem "has_role(admin)" ou "rz_is_admin()" (admin GLOBAL): um admin de uma
-- empresa lia e editava colaboradores, ausências, ponto, acessos, tickets... de TODAS as empresas.
--
-- O que muda (cada tabela: a policy antiga sai e a nova entra NA MESMA transação, porque policies
-- permissivas somam-se com OR e a antiga continuaria a abrir tudo):
--   * Dados de uma empresa (fichas, ausências, acessos, telefones, equipamentos, atribuições, avisos,
--     tickets, serviços recorrentes...): só o administrador dessa empresa (rz_is_company_admin, que inclui
--     o super admin). Tabelas filhas seguem a empresa do pai (rz_admin_of_*).
--   * Finanças e ponto (permissões de grupo, RH): só dentro das empresas onde a pessoa tem pertença.
--   * Jurídico: super admin, ou admin jurídico (rz_is_admin) nas empresas onde tem pertença.
--   * Catálogos e definições da plataforma (departamentos, funções, feriados, categorias, assuntos e
--     departamentos de suporte, emails de aviso, domínios, definições, regras do banco de horas): só a
--     equipa da plataforma (super admin ou conta de admin antiga/grupo: rz_is_platform_staff), nunca um
--     administrador de empresa. Leitura mantém-se como estava.
--   * Ficheiros (storage): documentos da ficha e de ausências pelo id do colaborador no caminho; anexos de
--     tickets pelo ticket.
--   * Avisos (notifications) sem empresa passam para a empresa com mais colaboradores (Realize), e quem
--     está num grupo com feed.read continua a vê-los (como o Feed). Sem isto, os avisos da Realize
--     apareciam às empresas externas.
--   * As contas de admin antigas sem pertença e a redução dos super admins ficam na migração seguinte
--     (20261123130000, transição), que se aplica logo a seguir.
--
-- Nada é apagado. Aplicar numa única chamada, depois do PR1 e do PR2.

-- ------------------------------------------------------------------ pré-verificação
DO $pre$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE active) THEN
    RAISE EXCEPTION 'p3_sem_super_admin: nao ha nenhum super admin ativo';
  END IF;
  IF to_regprocedure('public.rz_delete_company(uuid)') IS NULL THEN
    RAISE EXCEPTION 'p3_falta_pr2: aplique primeiro o PR2';
  END IF;
  IF EXISTS (SELECT 1 FROM public.companies c
              WHERE NOT EXISTS (SELECT 1 FROM public.company_memberships m
                                 WHERE m.company_id = c.id AND m.role = 'admin' AND m.status = 'ativo')) THEN
    RAISE EXCEPTION 'p3_empresa_sem_admin: ha empresas sem administrador ativo';
  END IF;
END
$pre$;

-- ------------------------------------------------------------------ funções de âmbito
CREATE OR REPLACE FUNCTION public.rz_is_platform_staff()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$ SELECT public.rz_is_super_admin() OR public.rz_is_admin() $function$;

CREATE OR REPLACE FUNCTION public.rz_admin_of_employee(p_employee uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.employees e
                  WHERE e.id = p_employee AND public.rz_is_company_admin(e.company_id));
$function$;

CREATE OR REPLACE FUNCTION public.rz_admin_of_absence(p_absence uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.absences a
                  WHERE a.id = p_absence AND public.rz_is_company_admin(a.company_id));
$function$;

CREATE OR REPLACE FUNCTION public.rz_admin_of_assignment(p_assignment uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.assignments a
                  WHERE a.id = p_assignment AND public.rz_is_company_admin(a.company_id));
$function$;

CREATE OR REPLACE FUNCTION public.rz_admin_of_ticket(p_ticket uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.support_tickets t
                  WHERE t.id = p_ticket AND public.rz_is_company_admin(t.company_id));
$function$;

CREATE OR REPLACE FUNCTION public.rz_admin_of_event(p_event uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.calendar_events e
                  WHERE e.id = p_event AND public.rz_is_company_admin(e.company_id));
$function$;

CREATE OR REPLACE FUNCTION public.rz_admin_of_mail_account(p_account uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.mail_accounts a
                  WHERE a.id = p_account AND public.rz_is_company_admin(a.company_id));
$function$;

-- A conta (colaborador ou administrador) pertence a uma empresa que o admin gere.
CREATE OR REPLACE FUNCTION public.rz_admin_of_user(p_user uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.employees e
                  WHERE (e.user_id = p_user OR e.admin_user_id = p_user)
                    AND public.rz_is_company_admin(e.company_id))
      OR EXISTS (SELECT 1 FROM public.company_memberships m
                  WHERE m.user_id = p_user AND m.status = 'ativo'
                    AND public.rz_is_company_admin(m.company_id));
$function$;

-- O colaborador é de uma empresa onde quem chama tem pertença ativa (ou é super admin).
CREATE OR REPLACE FUNCTION public.rz_member_of_employee_company(p_employee uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.employees e
                  WHERE e.id = p_employee
                    AND (e.company_id = ANY (public.rz_my_company_ids()) OR public.rz_is_super_admin()));
$function$;

-- Finanças: super admin, ou membro do grupo RH com pertença na empresa do colaborador.
CREATE OR REPLACE FUNCTION public.rz_hr_of_employee(p_employee uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.rz_is_super_admin()
      OR (public.is_rh_member(auth.uid()) AND public.rz_member_of_employee_company(p_employee));
$function$;

CREATE OR REPLACE FUNCTION public.rz_legal_scope(p_company uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.rz_is_super_admin()
      OR (public.rz_is_admin() AND p_company IS NOT NULL AND p_company = ANY (public.rz_my_company_ids()));
$function$;

CREATE OR REPLACE FUNCTION public.rz_legal_scope_client(p_client uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.legal_clients l
                  WHERE l.id = p_client AND public.rz_legal_scope(l.company_id));
$function$;

-- Primeiro id (uuid) seguido de '/' no caminho de um ficheiro: o colaborador nos documentos.
CREATE OR REPLACE FUNCTION public.rz_path_uuid(p_name text)
 RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE WHEN m[1] IS NULL THEN NULL ELSE m[1]::uuid END
  FROM (SELECT regexp_match(p_name, '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/') AS m) x;
$function$;

CREATE OR REPLACE FUNCTION public.rz_admin_of_employee_path(p_name text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.rz_is_super_admin() OR public.rz_admin_of_employee(public.rz_path_uuid(p_name));
$function$;

-- Equipa de suporte: o administrador da empresa do ticket, ou quem está no departamento da equipa mas
-- só nos tickets das empresas onde tem pertença.
CREATE OR REPLACE FUNCTION public.rz_can_handle_ticket(p_ticket uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.rz_admin_of_ticket(p_ticket) OR EXISTS (
    SELECT 1 FROM support_tickets st
    WHERE st.id = p_ticket
      AND st.department_id IN (SELECT public.rz_support_desk_departments())
      AND NOT public.ticket_is_mine(st.id)
      AND st.company_id = ANY (public.rz_my_company_ids())
  );
$function$;

-- As empresas pares (mesmo grupo, com feed.read) da pessoa: para os avisos. rz_group_peer_companies não é
-- executável por authenticated (só por funções definer): este embrulho expõe-na às policies.
CREATE OR REPLACE FUNCTION public.rz_feed_peer_companies()
 RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$ SELECT public.rz_group_peer_companies('feed.read') $function$;

DO $g$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY[
    'rz_is_platform_staff()', 'rz_admin_of_employee(uuid)', 'rz_admin_of_absence(uuid)',
    'rz_admin_of_assignment(uuid)', 'rz_admin_of_ticket(uuid)', 'rz_admin_of_event(uuid)',
    'rz_admin_of_mail_account(uuid)', 'rz_admin_of_user(uuid)', 'rz_member_of_employee_company(uuid)',
    'rz_hr_of_employee(uuid)', 'rz_legal_scope(uuid)', 'rz_legal_scope_client(uuid)', 'rz_path_uuid(text)',
    'rz_admin_of_employee_path(text)', 'rz_feed_peer_companies()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', s);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', s);
  END LOOP;
END
$g$;

-- ------------------------------------------------------------------ policies das tabelas

-- ---- employees
DROP POLICY IF EXISTS "Admins can manage all employees" ON public.employees;
CREATE POLICY "Fichas: o admin da empresa gere" ON public.employees
  FOR ALL TO authenticated
  USING (public.rz_is_company_admin(company_id))
  WITH CHECK (public.rz_is_company_admin(company_id));

-- ---- absences
DROP POLICY IF EXISTS "Admins can manage all absences" ON public.absences;
CREATE POLICY "Ausências: o admin da empresa gere" ON public.absences
  FOR ALL TO authenticated
  USING (public.rz_is_company_admin(company_id))
  WITH CHECK (public.rz_is_company_admin(company_id));

-- ---- absence_periods
DROP POLICY IF EXISTS "Admins can manage all absence periods" ON public.absence_periods;
CREATE POLICY "Períodos de ausência: o admin da empresa gere" ON public.absence_periods
  FOR ALL TO authenticated
  USING (public.rz_admin_of_absence(absence_id))
  WITH CHECK (public.rz_admin_of_absence(absence_id));

-- ---- absence_documents
DROP POLICY IF EXISTS "Admins can manage all absence documents" ON public.absence_documents;
DROP POLICY IF EXISTS "Admins can view all absence documents" ON public.absence_documents;
CREATE POLICY "Documentos de ausência: o admin da empresa gere" ON public.absence_documents
  FOR ALL TO authenticated
  USING (public.rz_admin_of_absence(absence_id))
  WITH CHECK (public.rz_admin_of_absence(absence_id));

-- ---- accesses
DROP POLICY IF EXISTS "Admins can manage all accesses" ON public.accesses;
CREATE POLICY "Acessos: o admin da empresa gere" ON public.accesses
  FOR ALL TO authenticated
  USING (public.rz_is_company_admin(company_id))
  WITH CHECK (public.rz_is_company_admin(company_id));

-- ---- access_categories
DROP POLICY IF EXISTS "Admins can manage all access categories" ON public.access_categories;
CREATE POLICY "Categorias de acesso: só a equipa da plataforma" ON public.access_categories
  FOR ALL TO authenticated
  USING (public.rz_is_platform_staff())
  WITH CHECK (public.rz_is_platform_staff());

-- ---- admin_notification_preferences
DROP POLICY IF EXISTS "Admins can manage notification preferences" ON public.admin_notification_preferences;
CREATE POLICY "Preferências de aviso: as minhas (ou super admin)" ON public.admin_notification_preferences
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.rz_is_super_admin()))
  WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT public.rz_is_super_admin()));

-- ---- assignment_items
DROP POLICY IF EXISTS "Admins can manage all assignment items" ON public.assignment_items;
CREATE POLICY "Itens de atribuição: o admin da empresa gere" ON public.assignment_items
  FOR ALL TO authenticated
  USING (public.rz_admin_of_assignment(assignment_id))
  WITH CHECK (public.rz_admin_of_assignment(assignment_id));

-- ---- assignments
DROP POLICY IF EXISTS "Admins can manage all assignments" ON public.assignments;
CREATE POLICY "Atribuições: o admin da empresa gere" ON public.assignments
  FOR ALL TO authenticated
  USING (public.rz_is_company_admin(company_id))
  WITH CHECK (public.rz_is_company_admin(company_id));

-- ---- calendar_attendee_history
DROP POLICY IF EXISTS "Calendário: histórico (admin e organizador)" ON public.calendar_attendee_history;
CREATE POLICY "Calendário: histórico (admin da empresa e organizador)" ON public.calendar_attendee_history
  FOR SELECT TO authenticated
  USING (event_owner_id = (SELECT auth.uid()) OR public.rz_admin_of_event(event_id));

-- ---- departments
DROP POLICY IF EXISTS "Departamentos: admin gere" ON public.departments;
CREATE POLICY "Departamentos: só a equipa da plataforma gere" ON public.departments
  FOR ALL TO authenticated
  USING (public.rz_is_platform_staff())
  WITH CHECK (public.rz_is_platform_staff());

-- ---- job_positions
DROP POLICY IF EXISTS "Funções: admin gere" ON public.job_positions;
CREATE POLICY "Funções: só a equipa da plataforma gere" ON public.job_positions
  FOR ALL TO authenticated
  USING (public.rz_is_platform_staff())
  WITH CHECK (public.rz_is_platform_staff());

-- ---- holidays
DROP POLICY IF EXISTS "Admins can manage holidays" ON public.holidays;
CREATE POLICY "Feriados: só a equipa da plataforma gere" ON public.holidays
  FOR ALL TO authenticated
  USING (public.rz_is_platform_staff())
  WITH CHECK (public.rz_is_platform_staff());

-- ---- employee_attachments
DROP POLICY IF EXISTS "Admins can manage employee attachments" ON public.employee_attachments;
CREATE POLICY "Anexos da ficha: o admin da empresa gere" ON public.employee_attachments
  FOR ALL TO authenticated
  USING (public.rz_admin_of_employee(employee_id))
  WITH CHECK (public.rz_admin_of_employee(employee_id));

-- ---- employee_department_emails
DROP POLICY IF EXISTS "Admins can manage all employee department emails" ON public.employee_department_emails;
CREATE POLICY "Emails de departamento: o admin da empresa gere" ON public.employee_department_emails
  FOR ALL TO authenticated
  USING (public.rz_admin_of_employee(employee_id))
  WITH CHECK (public.rz_admin_of_employee(employee_id));

-- ---- employee_documents
DROP POLICY IF EXISTS "Admins can manage employee documents" ON public.employee_documents;
CREATE POLICY "Documentos da ficha: o admin da empresa gere" ON public.employee_documents
  FOR ALL TO authenticated
  USING (public.rz_admin_of_employee(employee_id))
  WITH CHECK (public.rz_admin_of_employee(employee_id));

-- ---- employee_vacation_balances
DROP POLICY IF EXISTS "Admins can manage all vacation balances" ON public.employee_vacation_balances;
CREATE POLICY "Saldos de férias: o admin da empresa gere" ON public.employee_vacation_balances
  FOR ALL TO authenticated
  USING (public.rz_admin_of_employee(employee_id))
  WITH CHECK (public.rz_admin_of_employee(employee_id));

-- ---- folder_assignments
DROP POLICY IF EXISTS "Admins gerem as pastas atribuídas" ON public.folder_assignments;
CREATE POLICY "Pastas atribuídas: o admin da empresa gere" ON public.folder_assignments
  FOR ALL TO authenticated
  USING (public.rz_admin_of_employee(employee_id))
  WITH CHECK (public.rz_admin_of_employee(employee_id));

-- ---- employee_monthly_finances
DROP POLICY IF EXISTS "RH or super admin can delete employee finances" ON public.employee_monthly_finances;
DROP POLICY IF EXISTS "RH or super admin can insert employee finances" ON public.employee_monthly_finances;
DROP POLICY IF EXISTS "RH or super admin can update employee finances" ON public.employee_monthly_finances;
DROP POLICY IF EXISTS "Admins with employees access can view finances" ON public.employee_monthly_finances;
DROP POLICY IF EXISTS "RH can view employee finances" ON public.employee_monthly_finances;
CREATE POLICY "Finanças: RH da empresa ou super admin apaga" ON public.employee_monthly_finances
  FOR DELETE TO authenticated
  USING (public.rz_hr_of_employee(employee_id));
CREATE POLICY "Finanças: RH da empresa ou super admin insere" ON public.employee_monthly_finances
  FOR INSERT TO authenticated
  WITH CHECK (public.rz_hr_of_employee(employee_id));
CREATE POLICY "Finanças: RH da empresa ou super admin altera" ON public.employee_monthly_finances
  FOR UPDATE TO authenticated
  USING (public.rz_hr_of_employee(employee_id))
  WITH CHECK (public.rz_hr_of_employee(employee_id));
CREATE POLICY "Finanças: quem tem Colaboradores vê, só na sua empresa" ON public.employee_monthly_finances
  FOR SELECT TO authenticated
  USING ((has_module_permission(auth.uid(), 'employees'::text, 'view'::text) OR has_module_permission(auth.uid(), 'employees'::text, 'execute'::text)) AND public.rz_member_of_employee_company(employee_id));
CREATE POLICY "Finanças: RH vê (financeiro), só na sua empresa" ON public.employee_monthly_finances
  FOR SELECT TO authenticated
  USING ((has_module_permission(auth.uid(), 'employees'::text, 'view'::text, 'financial'::text) OR has_module_permission(auth.uid(), 'employees'::text, 'execute'::text, 'financial'::text)) AND public.rz_member_of_employee_company(employee_id));

-- ---- equipment_categories
DROP POLICY IF EXISTS "Admins can manage equipment categories" ON public.equipment_categories;
CREATE POLICY "Categorias de equipamento: só a equipa da plataforma" ON public.equipment_categories
  FOR ALL TO authenticated
  USING (public.rz_is_platform_staff())
  WITH CHECK (public.rz_is_platform_staff());

-- ---- equipments
DROP POLICY IF EXISTS "Admins can manage equipments" ON public.equipments;
CREATE POLICY "Equipamentos: o admin da empresa gere" ON public.equipments
  FOR ALL TO authenticated
  USING (public.rz_is_company_admin(company_id))
  WITH CHECK (public.rz_is_company_admin(company_id));

-- ---- legal_clients
DROP POLICY IF EXISTS "Jurídico: só administradores" ON public.legal_clients;
CREATE POLICY "Jurídico: clientes só do admin jurídico da empresa" ON public.legal_clients
  FOR ALL TO authenticated
  USING (public.rz_legal_scope(company_id))
  WITH CHECK (public.rz_legal_scope(company_id));

-- ---- legal_installments
DROP POLICY IF EXISTS "Jurídico: só administradores" ON public.legal_installments;
CREATE POLICY "Jurídico: prestações só do admin jurídico da empresa" ON public.legal_installments
  FOR ALL TO authenticated
  USING (public.rz_legal_scope_client(client_id))
  WITH CHECK (public.rz_legal_scope_client(client_id));

-- ---- legal_client_documents
DROP POLICY IF EXISTS "Jurídico: só administradores" ON public.legal_client_documents;
CREATE POLICY "Jurídico: documentos só do admin jurídico da empresa" ON public.legal_client_documents
  FOR ALL TO authenticated
  USING (public.rz_legal_scope_client(client_id))
  WITH CHECK (public.rz_legal_scope_client(client_id));

-- ---- mail_account_members
DROP POLICY IF EXISTS "Mail: ver as próprias partilhas" ON public.mail_account_members;
CREATE POLICY "Mail: ver as próprias partilhas (ou admin da empresa da caixa)" ON public.mail_account_members
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.rz_admin_of_mail_account(account_id));

-- ---- marketing_emails
DROP POLICY IF EXISTS "Admins can manage marketing emails" ON public.marketing_emails;
CREATE POLICY "Marketing: super admin ou admin da empresa" ON public.marketing_emails
  FOR ALL TO authenticated
  USING ((SELECT public.rz_is_super_admin()) OR (company_id IS NOT NULL AND public.rz_is_company_admin(company_id)))
  WITH CHECK ((SELECT public.rz_is_super_admin()) OR (company_id IS NOT NULL AND public.rz_is_company_admin(company_id)));

-- ---- notice_reactions
DROP POLICY IF EXISTS "Comunicados: ver reações" ON public.notice_reactions;
CREATE POLICY "Comunicados: ver reações" ON public.notice_reactions
  FOR SELECT TO authenticated
  USING ((SELECT public.rz_is_super_admin()) OR (EXISTS (SELECT 1 FROM notifications n WHERE n.id = notice_reactions.notification_id)));

-- ---- notification_emails_absences
DROP POLICY IF EXISTS "Admins can manage absence notification emails" ON public.notification_emails_absences;
CREATE POLICY "Emails de aviso de ausências: só a equipa da plataforma" ON public.notification_emails_absences
  FOR ALL TO authenticated
  USING (public.rz_is_platform_staff())
  WITH CHECK (public.rz_is_platform_staff());

-- ---- notification_emails_birthdays
DROP POLICY IF EXISTS "Admins can manage birthday notification emails" ON public.notification_emails_birthdays;
CREATE POLICY "Emails de aniversários: só a equipa da plataforma" ON public.notification_emails_birthdays
  FOR ALL TO authenticated
  USING (public.rz_is_platform_staff())
  WITH CHECK (public.rz_is_platform_staff());

-- ---- notification_emails_support
DROP POLICY IF EXISTS "Admins can manage support notification emails" ON public.notification_emails_support;
CREATE POLICY "Emails de suporte: só a equipa da plataforma" ON public.notification_emails_support
  FOR ALL TO authenticated
  USING (public.rz_is_platform_staff())
  WITH CHECK (public.rz_is_platform_staff());

-- ---- notification_reads
DROP POLICY IF EXISTS "Admins can view all notification reads" ON public.notification_reads;
CREATE POLICY "Leituras de avisos: o admin da empresa vê" ON public.notification_reads
  FOR SELECT TO authenticated
  USING (public.rz_admin_of_employee(employee_id));

-- ---- notifications
DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Employees can view active notifications for their company or in" ON public.notifications;
CREATE POLICY "Avisos: ver os da minha empresa, do grupo ou pessoais" ON public.notifications
  FOR SELECT TO authenticated
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()) AND ((company_id IS NULL AND employee_id IS NULL) OR (company_id = get_employee_company_id(auth.uid()) AND employee_id IS NULL) OR (company_id = ANY ((SELECT public.rz_feed_peer_companies())::uuid[]) AND employee_id IS NULL) OR employee_id = get_employee_id_from_user(auth.uid())));
CREATE POLICY "Avisos: o admin da empresa gere" ON public.notifications
  FOR ALL TO authenticated
  USING ((SELECT public.rz_is_super_admin()) OR (employee_id IS NOT NULL AND public.rz_admin_of_employee(employee_id)) OR (company_id IS NOT NULL AND public.rz_is_company_admin(company_id)))
  WITH CHECK ((SELECT public.rz_is_super_admin()) OR (employee_id IS NOT NULL AND public.rz_admin_of_employee(employee_id)) OR (company_id IS NOT NULL AND public.rz_is_company_admin(company_id)));

-- ---- phones
DROP POLICY IF EXISTS "Admins can manage all phones" ON public.phones;
CREATE POLICY "Telefones: o admin da empresa gere" ON public.phones
  FOR ALL TO authenticated
  USING (public.rz_is_company_admin(company_id))
  WITH CHECK (public.rz_is_company_admin(company_id));

-- ---- profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Perfis: o admin da empresa vê" ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT public.rz_is_super_admin()) OR public.rz_admin_of_user(user_id));

-- ---- recurring_services
DROP POLICY IF EXISTS "Admins can manage recurring_services" ON public.recurring_services;
CREATE POLICY "Serviços recorrentes: o admin da empresa gere" ON public.recurring_services
  FOR ALL TO authenticated
  USING (public.rz_is_company_admin(company_id))
  WITH CHECK (public.rz_is_company_admin(company_id));

-- ---- site_domains
DROP POLICY IF EXISTS "Admins can manage site_domains" ON public.site_domains;
CREATE POLICY "Domínios: só a equipa da plataforma" ON public.site_domains
  FOR ALL TO authenticated
  USING (public.rz_is_platform_staff())
  WITH CHECK (public.rz_is_platform_staff());

-- ---- support_department_teams
DROP POLICY IF EXISTS "Suporte: gerir equipas" ON public.support_department_teams;
CREATE POLICY "Suporte: equipas só a equipa da plataforma gere" ON public.support_department_teams
  FOR ALL TO authenticated
  USING (public.rz_is_platform_staff())
  WITH CHECK (public.rz_is_platform_staff());

-- ---- support_departments
DROP POLICY IF EXISTS "Admins can manage all departments" ON public.support_departments;
CREATE POLICY "Departamentos de suporte: só a equipa da plataforma" ON public.support_departments
  FOR ALL TO authenticated
  USING (public.rz_is_platform_staff())
  WITH CHECK (public.rz_is_platform_staff());

-- ---- support_ticket_subjects
DROP POLICY IF EXISTS "Admins can manage all subjects" ON public.support_ticket_subjects;
CREATE POLICY "Assuntos de suporte: só a equipa da plataforma" ON public.support_ticket_subjects
  FOR ALL TO authenticated
  USING (public.rz_is_platform_staff())
  WITH CHECK (public.rz_is_platform_staff());

-- ---- support_tickets
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.support_tickets;
CREATE POLICY "Tickets: o admin da empresa gere" ON public.support_tickets
  FOR ALL TO authenticated
  USING (public.rz_is_company_admin(company_id))
  WITH CHECK (public.rz_is_company_admin(company_id));

-- ---- support_ticket_replies
DROP POLICY IF EXISTS "Admins can reply to tickets" ON public.support_ticket_replies;
DROP POLICY IF EXISTS "Admins can view all replies" ON public.support_ticket_replies;
CREATE POLICY "Tickets: o admin da empresa responde" ON public.support_ticket_replies
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND sender_role = 'admin'::text AND public.rz_admin_of_ticket(ticket_id));
CREATE POLICY "Tickets: o admin da empresa vê as respostas" ON public.support_ticket_replies
  FOR SELECT TO authenticated
  USING (public.rz_admin_of_ticket(ticket_id));

-- ---- support_ticket_attachments
DROP POLICY IF EXISTS "Employees can insert ticket attachments" ON public.support_ticket_attachments;
DROP POLICY IF EXISTS "Employees can view own ticket attachments" ON public.support_ticket_attachments;
CREATE POLICY "Tickets: enviar anexos (dono ou admin da empresa)" ON public.support_ticket_attachments
  FOR INSERT TO authenticated,mail_client
  WITH CHECK (uploaded_by = (SELECT auth.uid()) AND (ticket_is_mine(ticket_id) OR public.rz_admin_of_ticket(ticket_id)));
CREATE POLICY "Tickets: ver anexos (dono ou admin da empresa)" ON public.support_ticket_attachments
  FOR SELECT TO authenticated
  USING ((EXISTS (SELECT 1 FROM support_tickets st JOIN employees e ON e.id = st.employee_id WHERE st.id = support_ticket_attachments.ticket_id AND e.user_id = (SELECT auth.uid()))) OR public.rz_admin_of_ticket(ticket_id));

-- ---- system_settings
DROP POLICY IF EXISTS "Admins can insert settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can view settings" ON public.system_settings;
CREATE POLICY "Definições: só a equipa da plataforma insere" ON public.system_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.rz_is_platform_staff());
CREATE POLICY "Definições: só a equipa da plataforma altera" ON public.system_settings
  FOR UPDATE TO authenticated
  USING (public.rz_is_platform_staff());
CREATE POLICY "Definições: só a equipa da plataforma vê" ON public.system_settings
  FOR SELECT TO authenticated
  USING (public.rz_is_platform_staff());

-- ---- time_clock_settings
DROP POLICY IF EXISTS "Banco de horas: admins mudam regras" ON public.time_clock_settings;
CREATE POLICY "Banco de horas: só a equipa da plataforma muda as regras" ON public.time_clock_settings
  FOR UPDATE TO authenticated
  USING (public.rz_is_platform_staff())
  WITH CHECK (public.rz_is_platform_staff());

-- ---- time_clock_entries
DROP POLICY IF EXISTS "Timeclock admins view time entries" ON public.time_clock_entries;
CREATE POLICY "Ponto: quem tem permissão vê, só na sua empresa" ON public.time_clock_entries
  FOR SELECT TO authenticated
  USING ((SELECT public.rz_is_super_admin()) OR public.rz_is_company_admin(company_id) OR (has_timeclock_permission(auth.uid(), 'view'::text) AND company_id = ANY ((SELECT public.rz_my_company_ids())::uuid[])));

-- ---- time_clock_attempts
DROP POLICY IF EXISTS "Timeclock admins view attempts" ON public.time_clock_attempts;
CREATE POLICY "Ponto: tentativas, só na sua empresa" ON public.time_clock_attempts
  FOR SELECT TO authenticated
  USING ((SELECT public.rz_is_super_admin()) OR public.rz_admin_of_employee(employee_id) OR (has_timeclock_permission(auth.uid(), 'view'::text) AND public.rz_member_of_employee_company(employee_id)));

-- ---- time_clock_entry_history
DROP POLICY IF EXISTS "Timeclock admins view history" ON public.time_clock_entry_history;
CREATE POLICY "Ponto: histórico, só na sua empresa" ON public.time_clock_entry_history
  FOR SELECT TO authenticated
  USING ((SELECT public.rz_is_super_admin()) OR public.rz_admin_of_employee(employee_id) OR (has_timeclock_permission(auth.uid(), 'view'::text) AND public.rz_member_of_employee_company(employee_id)));

-- ---- time_clock_locations
DROP POLICY IF EXISTS "Timeclock admins view locations" ON public.time_clock_locations;
DROP POLICY IF EXISTS "Timeclock managers delete locations" ON public.time_clock_locations;
DROP POLICY IF EXISTS "Timeclock managers insert locations" ON public.time_clock_locations;
DROP POLICY IF EXISTS "Timeclock managers update locations" ON public.time_clock_locations;
CREATE POLICY "Ponto: locais, quem tem permissão vê, só na sua empresa" ON public.time_clock_locations
  FOR SELECT TO authenticated
  USING ((SELECT public.rz_is_super_admin()) OR public.rz_is_company_admin(company_id) OR (has_timeclock_permission(auth.uid(), 'view'::text) AND company_id = ANY ((SELECT public.rz_my_company_ids())::uuid[])));
CREATE POLICY "Ponto: locais, quem gere apaga, só na sua empresa" ON public.time_clock_locations
  FOR DELETE TO authenticated
  USING ((SELECT public.rz_is_super_admin()) OR public.rz_is_company_admin(company_id) OR (has_timeclock_permission(auth.uid(), 'execute'::text, 'locations'::text) AND company_id = ANY ((SELECT public.rz_my_company_ids())::uuid[])));
CREATE POLICY "Ponto: locais, quem gere cria, só na sua empresa" ON public.time_clock_locations
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.rz_is_super_admin()) OR public.rz_is_company_admin(company_id) OR (has_timeclock_permission(auth.uid(), 'execute'::text, 'locations'::text) AND company_id = ANY ((SELECT public.rz_my_company_ids())::uuid[])));
CREATE POLICY "Ponto: locais, quem gere altera, só na sua empresa" ON public.time_clock_locations
  FOR UPDATE TO authenticated
  USING ((SELECT public.rz_is_super_admin()) OR public.rz_is_company_admin(company_id) OR (has_timeclock_permission(auth.uid(), 'execute'::text, 'locations'::text) AND company_id = ANY ((SELECT public.rz_my_company_ids())::uuid[])))
  WITH CHECK ((SELECT public.rz_is_super_admin()) OR public.rz_is_company_admin(company_id) OR (has_timeclock_permission(auth.uid(), 'execute'::text, 'locations'::text) AND company_id = ANY ((SELECT public.rz_my_company_ids())::uuid[])));

-- ------------------------------------------------------------------ ficheiros (storage)
DROP POLICY IF EXISTS "Admins can manage all absence documents in storage" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all absence documents in storage" ON storage.objects;
CREATE POLICY "Documentos de ausência: o admin da empresa gere" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'absence-documents' AND public.rz_admin_of_employee_path(name))
  WITH CHECK (bucket_id = 'absence-documents' AND public.rz_admin_of_employee_path(name));

DROP POLICY IF EXISTS "Admins can manage all employee files" ON storage.objects;
CREATE POLICY "Ficheiros da ficha: o admin da empresa gere" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'employee-files' AND public.rz_admin_of_employee_path(name))
  WITH CHECK (bucket_id = 'employee-files' AND public.rz_admin_of_employee_path(name));

DROP POLICY IF EXISTS "Tickets: enviar anexos" ON storage.objects;
CREATE POLICY "Tickets: enviar anexos" ON storage.objects
  FOR INSERT TO authenticated, mail_client
  WITH CHECK (bucket_id = 'ticket-attachments'
              AND (public.rz_admin_of_ticket(ticket_path_ticket(name)) OR ticket_is_mine(ticket_path_ticket(name))));
DROP POLICY IF EXISTS "Tickets: ler anexos" ON storage.objects;
CREATE POLICY "Tickets: ler anexos" ON storage.objects
  FOR SELECT TO authenticated, mail_client
  USING (bucket_id = 'ticket-attachments'
         AND (public.rz_admin_of_ticket(ticket_path_ticket(name)) OR ticket_is_mine(ticket_path_ticket(name))));

-- ------------------------------------------------------------------ dados
DO $d$
DECLARE
  v_realize uuid;
BEGIN
  -- A empresa com mais colaboradores (a Realize).
  SELECT c.id INTO v_realize
  FROM public.companies c
  ORDER BY (SELECT count(*) FROM public.employees e WHERE e.company_id = c.id) DESC, c.created_at
  LIMIT 1;

  -- Avisos para todos (sem empresa nem colaborador) passam a ser da Realize (e dos pares do grupo).
  UPDATE public.notifications
     SET company_id = v_realize
   WHERE company_id IS NULL AND employee_id IS NULL;
END
$d$;
