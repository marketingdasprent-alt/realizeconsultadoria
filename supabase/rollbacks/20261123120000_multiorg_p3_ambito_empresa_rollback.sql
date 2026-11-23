-- Reverte o PR3 multi-organização (âmbito por empresa): repõe as policies "admin global" anteriores e a
-- rz_can_handle_ticket antiga, retira as funções de âmbito e desfaz os dados (avisos sem empresa voltam a
-- ficar sem empresa; ). ATENÇÃO: reabre os dados de todas as
-- empresas a qualquer administrador antigo. Só para emergência. Aplicar numa única chamada.

-- storage
DROP POLICY IF EXISTS "Documentos de ausência: o admin da empresa gere" ON storage.objects;
DROP POLICY IF EXISTS "Ficheiros da ficha: o admin da empresa gere" ON storage.objects;
DROP POLICY IF EXISTS "Tickets: enviar anexos" ON storage.objects;
DROP POLICY IF EXISTS "Tickets: ler anexos" ON storage.objects;
DROP POLICY IF EXISTS "Documentos jurídicos: só o jurídico apaga" ON storage.objects;
DROP POLICY IF EXISTS "Documentos jurídicos: só o jurídico envia" ON storage.objects;
DROP POLICY IF EXISTS "Documentos jurídicos: só o jurídico vê" ON storage.objects;
DROP POLICY IF EXISTS "Faturas de equipamento: só a equipa da plataforma" ON storage.objects;
CREATE POLICY "Admins can manage all absence documents in storage" ON storage.objects
  AS PERMISSIVE FOR ALL TO authenticated
  USING (((bucket_id = 'absence-documents'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins can manage all employee files" ON storage.objects
  AS PERMISSIVE FOR ALL TO authenticated
  USING (((bucket_id = 'employee-files'::text) AND has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK (((bucket_id = 'employee-files'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins can view all absence documents in storage" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'absence-documents'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Tickets: enviar anexos" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated,mail_client
  WITH CHECK (((bucket_id = 'ticket-attachments'::text) AND (rz_is_admin() OR ticket_is_mine(ticket_path_ticket(name)))));
CREATE POLICY "Tickets: ler anexos" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated,mail_client
  USING (((bucket_id = 'ticket-attachments'::text) AND (rz_is_admin() OR ticket_is_mine(ticket_path_ticket(name)))));
CREATE POLICY "Documentos jurídicos: administradores apagam" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'legal_documents'::text) AND rz_is_admin()));
CREATE POLICY "Documentos jurídicos: administradores enviam" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'legal_documents'::text) AND rz_is_admin()));
CREATE POLICY "Documentos jurídicos: administradores veem" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'legal_documents'::text) AND rz_is_admin()));
CREATE POLICY "Faturas de equipamento: só administradores" ON storage.objects
  AS PERMISSIVE FOR ALL TO authenticated
  USING (((bucket_id = 'equipment_invoices'::text) AND rz_is_admin()))
  WITH CHECK (((bucket_id = 'equipment_invoices'::text) AND rz_is_admin()));

-- ---- employees
DROP POLICY IF EXISTS "Fichas: o admin da empresa gere" ON public.employees;
CREATE POLICY "Admins can manage all employees" ON public.employees
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- absences
DROP POLICY IF EXISTS "Ausências: o admin da empresa gere" ON public.absences;
CREATE POLICY "Admins can manage all absences" ON public.absences
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- absence_periods
DROP POLICY IF EXISTS "Períodos de ausência: o admin da empresa gere" ON public.absence_periods;
CREATE POLICY "Admins can manage all absence periods" ON public.absence_periods
  AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- absence_documents
DROP POLICY IF EXISTS "Documentos de ausência: o admin da empresa gere" ON public.absence_documents;
CREATE POLICY "Admins can manage all absence documents" ON public.absence_documents
  AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all absence documents" ON public.absence_documents
  AS PERMISSIVE FOR SELECT TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- accesses
DROP POLICY IF EXISTS "Acessos: o admin da empresa gere" ON public.accesses;
CREATE POLICY "Admins can manage all accesses" ON public.accesses
  AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- access_categories
DROP POLICY IF EXISTS "Categorias de acesso: só a equipa da plataforma" ON public.access_categories;
CREATE POLICY "Admins can manage all access categories" ON public.access_categories
  AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- admin_notification_preferences
DROP POLICY IF EXISTS "Preferências de aviso: as minhas (ou super admin)" ON public.admin_notification_preferences;
CREATE POLICY "Admins can manage notification preferences" ON public.admin_notification_preferences
  AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- assignment_items
DROP POLICY IF EXISTS "Itens de atribuição: o admin da empresa gere" ON public.assignment_items;
CREATE POLICY "Admins can manage all assignment items" ON public.assignment_items
  AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- assignments
DROP POLICY IF EXISTS "Atribuições: o admin da empresa gere" ON public.assignments;
CREATE POLICY "Admins can manage all assignments" ON public.assignments
  AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- calendar_attendee_history
DROP POLICY IF EXISTS "Calendário: histórico (admin da empresa e organizador)" ON public.calendar_attendee_history;
CREATE POLICY "Calendário: histórico (admin e organizador)" ON public.calendar_attendee_history
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR (event_owner_id = auth.uid())));

-- ---- departments
DROP POLICY IF EXISTS "Departamentos: só a equipa da plataforma gere" ON public.departments;
CREATE POLICY "Departamentos: admin gere" ON public.departments
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---- job_positions
DROP POLICY IF EXISTS "Funções: só a equipa da plataforma gere" ON public.job_positions;
CREATE POLICY "Funções: admin gere" ON public.job_positions
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---- holidays
DROP POLICY IF EXISTS "Feriados: só a equipa da plataforma gere" ON public.holidays;
CREATE POLICY "Admins can manage holidays" ON public.holidays
  AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- employee_attachments
DROP POLICY IF EXISTS "Anexos da ficha: o admin da empresa gere" ON public.employee_attachments;
CREATE POLICY "Admins can manage employee attachments" ON public.employee_attachments
  AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---- employee_department_emails
DROP POLICY IF EXISTS "Emails de departamento: o admin da empresa gere" ON public.employee_department_emails;
CREATE POLICY "Admins can manage all employee department emails" ON public.employee_department_emails
  AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- employee_documents
DROP POLICY IF EXISTS "Documentos da ficha: o admin da empresa gere" ON public.employee_documents;
CREATE POLICY "Admins can manage employee documents" ON public.employee_documents
  AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---- employee_vacation_balances
DROP POLICY IF EXISTS "Saldos de férias: o admin da empresa gere" ON public.employee_vacation_balances;
CREATE POLICY "Admins can manage all vacation balances" ON public.employee_vacation_balances
  AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- folder_assignments
DROP POLICY IF EXISTS "Pastas atribuídas: o admin da empresa gere" ON public.folder_assignments;
CREATE POLICY "Admins gerem as pastas atribuídas" ON public.folder_assignments
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---- employee_monthly_finances
DROP POLICY IF EXISTS "Finanças: o admin da empresa vê" ON public.employee_monthly_finances;
DROP POLICY IF EXISTS "Finanças: RH da empresa ou super admin apaga" ON public.employee_monthly_finances;
DROP POLICY IF EXISTS "Finanças: RH da empresa ou super admin insere" ON public.employee_monthly_finances;
DROP POLICY IF EXISTS "Finanças: RH da empresa ou super admin altera" ON public.employee_monthly_finances;
DROP POLICY IF EXISTS "Finanças: quem tem Colaboradores vê, só na sua empresa" ON public.employee_monthly_finances;
DROP POLICY IF EXISTS "Finanças: RH vê (financeiro), só na sua empresa" ON public.employee_monthly_finances;
CREATE POLICY "RH or super admin can delete employee finances" ON public.employee_monthly_finances
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ((is_rh_member(auth.uid()) OR is_super_admin_member(auth.uid())));
CREATE POLICY "RH or super admin can insert employee finances" ON public.employee_monthly_finances
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((is_rh_member(auth.uid()) OR is_super_admin_member(auth.uid())));
CREATE POLICY "RH or super admin can update employee finances" ON public.employee_monthly_finances
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((is_rh_member(auth.uid()) OR is_super_admin_member(auth.uid())))
  WITH CHECK ((is_rh_member(auth.uid()) OR is_super_admin_member(auth.uid())));
CREATE POLICY "Admins with employees access can view finances" ON public.employee_monthly_finances
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_module_permission(auth.uid(), 'employees'::text, 'view'::text) OR has_module_permission(auth.uid(), 'employees'::text, 'execute'::text)));
CREATE POLICY "RH can view employee finances" ON public.employee_monthly_finances
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_module_permission(auth.uid(), 'employees'::text, 'view'::text, 'financial'::text) OR has_module_permission(auth.uid(), 'employees'::text, 'execute'::text, 'financial'::text)));

-- ---- equipment_categories
DROP POLICY IF EXISTS "Categorias de equipamento: só a equipa da plataforma" ON public.equipment_categories;
CREATE POLICY "Admins can manage equipment categories" ON public.equipment_categories
  FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role) OR public.rz_is_super_admin())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR public.rz_is_super_admin());

-- ---- equipments
DROP POLICY IF EXISTS "Equipamentos: o admin da empresa gere" ON public.equipments;
CREATE POLICY "Admins can manage equipments" ON public.equipments
  FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role) OR public.rz_is_super_admin())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR public.rz_is_super_admin());

-- ---- legal_clients
DROP POLICY IF EXISTS "Jurídico: clientes só do admin jurídico da empresa" ON public.legal_clients;
CREATE POLICY "Jurídico: só administradores" ON public.legal_clients
  AS PERMISSIVE FOR ALL TO authenticated
  USING (rz_is_admin())
  WITH CHECK (rz_is_admin());

-- ---- legal_agenda_events
DROP POLICY IF EXISTS "Jurídico: agenda só do jurídico" ON public.legal_agenda_events;
CREATE POLICY "Jurídico: só administradores" ON public.legal_agenda_events
  AS PERMISSIVE FOR ALL TO authenticated
  USING (rz_is_admin())
  WITH CHECK (rz_is_admin());

-- ---- legal_installments
DROP POLICY IF EXISTS "Jurídico: prestações só do admin jurídico da empresa" ON public.legal_installments;
CREATE POLICY "Jurídico: só administradores" ON public.legal_installments
  AS PERMISSIVE FOR ALL TO authenticated
  USING (rz_is_admin())
  WITH CHECK (rz_is_admin());

-- ---- legal_client_documents
DROP POLICY IF EXISTS "Jurídico: documentos só do admin jurídico da empresa" ON public.legal_client_documents;
CREATE POLICY "Jurídico: só administradores" ON public.legal_client_documents
  AS PERMISSIVE FOR ALL TO authenticated
  USING (rz_is_admin())
  WITH CHECK (rz_is_admin());

-- ---- mail_account_members
DROP POLICY IF EXISTS "Mail: ver as próprias partilhas (ou admin da empresa da caixa)" ON public.mail_account_members;
CREATE POLICY "Mail: ver as próprias partilhas" ON public.mail_account_members
  AS PERMISSIVE FOR SELECT TO authenticated,mail_client
  USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

-- ---- marketing_emails
DROP POLICY IF EXISTS "Marketing: super admin ou admin da empresa" ON public.marketing_emails;
CREATE POLICY "Admins can manage marketing emails" ON public.marketing_emails
  AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1 FROM admin_group_members WHERE (admin_group_members.user_id = auth.uid()))));
CREATE POLICY "Admins with marketing access can insert emails" ON public.marketing_emails
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_module_permission(auth.uid(), 'marketing'::text, 'execute'::text, 'email'::text));
CREATE POLICY "Admins with marketing access can view emails" ON public.marketing_emails
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_module_permission(auth.uid(), 'marketing'::text, 'view'::text, 'email'::text) OR has_module_permission(auth.uid(), 'marketing'::text, 'execute'::text, 'email'::text)));

-- ---- notice_reactions
DROP POLICY IF EXISTS "Comunicados: ver reações" ON public.notice_reactions;
CREATE POLICY "Comunicados: ver reações" ON public.notice_reactions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((rz_is_admin() OR (EXISTS ( SELECT 1 FROM notifications n WHERE (n.id = notice_reactions.notification_id)))));

-- ---- notification_emails_absences
DROP POLICY IF EXISTS "Emails de aviso de ausências: só a equipa da plataforma" ON public.notification_emails_absences;
CREATE POLICY "Admins can manage absence notification emails" ON public.notification_emails_absences
  AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- notification_emails_birthdays
DROP POLICY IF EXISTS "Emails de aniversários: só a equipa da plataforma" ON public.notification_emails_birthdays;
CREATE POLICY "Admins can manage birthday notification emails" ON public.notification_emails_birthdays
  AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- notification_emails_support
DROP POLICY IF EXISTS "Emails de suporte: só a equipa da plataforma" ON public.notification_emails_support;
CREATE POLICY "Admins can manage support notification emails" ON public.notification_emails_support
  AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- notification_reads
DROP POLICY IF EXISTS "Leituras de avisos: o admin da empresa vê" ON public.notification_reads;
CREATE POLICY "Admins can view all notification reads" ON public.notification_reads
  AS PERMISSIVE FOR SELECT TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- notifications
DROP POLICY IF EXISTS "Avisos: ver os da minha empresa, do grupo ou pessoais" ON public.notifications;
DROP POLICY IF EXISTS "Avisos: o admin da empresa gere" ON public.notifications;
CREATE POLICY "Admins can manage all notifications" ON public.notifications
  AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Employees can view active notifications for their company or in" ON public.notifications
  AS PERMISSIVE FOR SELECT TO public
  USING (((is_active = true) AND ((expires_at IS NULL) OR (expires_at > now())) AND (((company_id IS NULL) AND (employee_id IS NULL)) OR ((company_id = get_employee_company_id(auth.uid())) AND (employee_id IS NULL)) OR (employee_id = get_employee_id_from_user(auth.uid())))));

-- ---- phones
DROP POLICY IF EXISTS "Telefones: o admin da empresa gere" ON public.phones;
CREATE POLICY "Admins can manage all phones" ON public.phones
  AS PERMISSIVE FOR ALL TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- profiles
DROP POLICY IF EXISTS "Perfis: o admin da empresa vê" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- recurring_services
DROP POLICY IF EXISTS "Serviços recorrentes: o admin da empresa gere" ON public.recurring_services;
CREATE POLICY "Admins can manage recurring_services" ON public.recurring_services
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---- site_domains
DROP POLICY IF EXISTS "Domínios: só a equipa da plataforma" ON public.site_domains;
CREATE POLICY "Admins can manage site_domains" ON public.site_domains
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role)))));

-- ---- support_department_teams
DROP POLICY IF EXISTS "Suporte: equipas só a equipa da plataforma gere" ON public.support_department_teams;
CREATE POLICY "Suporte: gerir equipas" ON public.support_department_teams
  AS PERMISSIVE FOR ALL TO authenticated
  USING (rz_is_admin())
  WITH CHECK (rz_is_admin());

-- ---- support_departments
DROP POLICY IF EXISTS "Departamentos de suporte: só a equipa da plataforma" ON public.support_departments;
CREATE POLICY "Admins can manage all departments" ON public.support_departments
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- support_ticket_subjects
DROP POLICY IF EXISTS "Assuntos de suporte: só a equipa da plataforma" ON public.support_ticket_subjects;
CREATE POLICY "Admins can manage all subjects" ON public.support_ticket_subjects
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- support_tickets
DROP POLICY IF EXISTS "Tickets: o admin da empresa gere" ON public.support_tickets;
CREATE POLICY "Admins can manage all tickets" ON public.support_tickets
  AS PERMISSIVE FOR ALL TO authenticated
  USING (rz_is_admin())
  WITH CHECK (rz_is_admin());

-- ---- support_ticket_replies
DROP POLICY IF EXISTS "Tickets: o admin da empresa responde" ON public.support_ticket_replies;
DROP POLICY IF EXISTS "Tickets: o admin da empresa vê as respostas" ON public.support_ticket_replies;
CREATE POLICY "Admins can reply to tickets" ON public.support_ticket_replies
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND (sender_role = 'admin'::text) AND rz_is_admin()));
CREATE POLICY "Admins can view all replies" ON public.support_ticket_replies
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (rz_is_admin());

-- ---- support_ticket_attachments
DROP POLICY IF EXISTS "Tickets: enviar anexos (dono ou admin da empresa)" ON public.support_ticket_attachments;
DROP POLICY IF EXISTS "Tickets: ver anexos (dono ou admin da empresa)" ON public.support_ticket_attachments;
CREATE POLICY "Employees can insert ticket attachments" ON public.support_ticket_attachments
  AS PERMISSIVE FOR INSERT TO authenticated,mail_client
  WITH CHECK (((uploaded_by = auth.uid()) AND (ticket_is_mine(ticket_id) OR rz_is_admin())));
CREATE POLICY "Employees can view own ticket attachments" ON public.support_ticket_attachments
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1 FROM (support_tickets st JOIN employees e ON ((e.id = st.employee_id))) WHERE ((st.id = support_ticket_attachments.ticket_id) AND (e.user_id = auth.uid())))) OR rz_is_admin()));

-- ---- system_settings
DROP POLICY IF EXISTS "Definições: só a equipa da plataforma insere" ON public.system_settings;
DROP POLICY IF EXISTS "Definições: só a equipa da plataforma altera" ON public.system_settings;
DROP POLICY IF EXISTS "Definições: só a equipa da plataforma vê" ON public.system_settings;
CREATE POLICY "Admins can insert settings" ON public.system_settings
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update settings" ON public.system_settings
  AS PERMISSIVE FOR UPDATE TO public
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view settings" ON public.system_settings
  AS PERMISSIVE FOR SELECT TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- time_clock_settings
DROP POLICY IF EXISTS "Banco de horas: só a equipa da plataforma muda as regras" ON public.time_clock_settings;
CREATE POLICY "Banco de horas: admins mudam regras" ON public.time_clock_settings
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (rz_is_admin())
  WITH CHECK (rz_is_admin());

-- ---- time_clock_entries
DROP POLICY IF EXISTS "Ponto: quem tem permissão vê, só na sua empresa" ON public.time_clock_entries;
CREATE POLICY "Timeclock admins view time entries" ON public.time_clock_entries
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (( SELECT has_timeclock_permission(auth.uid(), 'view'::text) AS has_timeclock_permission));

-- ---- time_clock_attempts
DROP POLICY IF EXISTS "Ponto: tentativas, só na sua empresa" ON public.time_clock_attempts;
CREATE POLICY "Timeclock admins view attempts" ON public.time_clock_attempts
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (( SELECT has_timeclock_permission(auth.uid(), 'view'::text) AS has_timeclock_permission));

-- ---- time_clock_entry_history
DROP POLICY IF EXISTS "Ponto: histórico, só na sua empresa" ON public.time_clock_entry_history;
CREATE POLICY "Timeclock admins view history" ON public.time_clock_entry_history
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (( SELECT has_timeclock_permission(auth.uid(), 'view'::text) AS has_timeclock_permission));

-- ---- time_clock_locations
DROP POLICY IF EXISTS "Ponto: locais, quem tem permissão vê, só na sua empresa" ON public.time_clock_locations;
DROP POLICY IF EXISTS "Ponto: locais, quem gere apaga, só na sua empresa" ON public.time_clock_locations;
DROP POLICY IF EXISTS "Ponto: locais, quem gere cria, só na sua empresa" ON public.time_clock_locations;
DROP POLICY IF EXISTS "Ponto: locais, quem gere altera, só na sua empresa" ON public.time_clock_locations;
CREATE POLICY "Timeclock admins view locations" ON public.time_clock_locations
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (( SELECT has_timeclock_permission(auth.uid(), 'view'::text) AS has_timeclock_permission));
CREATE POLICY "Timeclock managers delete locations" ON public.time_clock_locations
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (( SELECT has_timeclock_permission(auth.uid(), 'execute'::text, 'locations'::text) AS has_timeclock_permission));
CREATE POLICY "Timeclock managers insert locations" ON public.time_clock_locations
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (( SELECT has_timeclock_permission(auth.uid(), 'execute'::text, 'locations'::text) AS has_timeclock_permission));
CREATE POLICY "Timeclock managers update locations" ON public.time_clock_locations
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (( SELECT has_timeclock_permission(auth.uid(), 'execute'::text, 'locations'::text) AS has_timeclock_permission))
  WITH CHECK (( SELECT has_timeclock_permission(auth.uid(), 'execute'::text, 'locations'::text) AS has_timeclock_permission));

-- dados
UPDATE public.notifications SET company_id = NULL
 WHERE employee_id IS NULL AND company_id = (
   SELECT c.id FROM public.companies c
   ORDER BY (SELECT count(*) FROM public.employees e WHERE e.company_id = c.id) DESC, c.created_at LIMIT 1);

CREATE OR REPLACE FUNCTION public.rz_can_handle_ticket(p_ticket uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.rz_is_admin() OR EXISTS (
    SELECT 1 FROM support_tickets st
    WHERE st.id = p_ticket
      AND st.department_id IN (SELECT public.rz_support_desk_departments())
      AND NOT public.ticket_is_mine(st.id)
  );
$function$;

DROP TRIGGER IF EXISTS tr_rz_force_own_company ON public.absences;
DROP TRIGGER IF EXISTS tr_rz_force_own_company ON public.support_tickets;
DROP FUNCTION IF EXISTS public.rz_force_own_company();

-- support_desk_tickets: definição anterior (sem filtro por empresa).
CREATE OR REPLACE FUNCTION public.support_desk_tickets()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(
    to_jsonb(st)
      || jsonb_build_object(
        'employees', jsonb_build_object('name', e.name, 'email', e.email),
        'companies', jsonb_build_object('name', c.name)
      )
    ORDER BY st.created_at DESC), '[]'::jsonb)
  FROM support_tickets st
  JOIN employees e ON e.id = st.employee_id
  LEFT JOIN companies c ON c.id = st.company_id
  WHERE st.department_id IN (SELECT public.rz_support_desk_departments())
    AND coalesce(e.user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid();
$$;

DO $fx$
DECLARE v_def text; v_fn text;
BEGIN
  SELECT pg_get_functiondef('public.access_password(uuid)'::regprocedure) INTO v_def;
  EXECUTE replace(v_def, 'NOT COALESCE((SELECT public.rz_is_company_admin(a0.company_id) OR (a0.company_id IS NULL AND public.rz_is_super_admin()) FROM public.accesses a0 WHERE a0.id = _access_id), false) THEN', 'NOT has_role(auth.uid(), ''admin'') THEN');
  SELECT pg_get_functiondef('public.phone_codes(uuid[])'::regprocedure) INTO v_def;
  EXECUTE replace(v_def, 'IF NOT (SELECT public.rz_is_super_admin()) AND EXISTS (SELECT 1 FROM public.phones p0 WHERE p0.id = ANY(_phone_ids) AND NOT public.rz_is_company_admin(p0.company_id)) THEN', 'IF NOT has_role(auth.uid(), ''admin'') THEN');
  SELECT pg_get_functiondef('public.reschedule_vacation(uuid,jsonb,text)'::regprocedure) INTO v_def;
  EXECUTE replace(v_def, 'v_is_admin := public.rz_admin_of_employee(v_absence.employee_id);', 'v_is_admin := public.has_role(auth.uid(), ''admin''::public.app_role);');
  SELECT pg_get_functiondef('public.review_employee_document(uuid,text,text,text,date,date,date,text)'::regprocedure) INTO v_def;
  EXECUTE replace(v_def, 'IF NOT COALESCE((SELECT public.rz_admin_of_employee(d0.employee_id) FROM public.employee_documents d0 WHERE d0.id = _document_id), false) THEN', 'IF NOT public.has_role(auth.uid(), ''admin''::app_role) THEN');
  SELECT pg_get_functiondef('public.mail_access_status()'::regprocedure) INTO v_def;
  EXECUTE replace(v_def, 'AND (public.rz_is_company_admin(m.company_id) OR (m.company_id IS NULL AND public.rz_is_super_admin()))', 'AND has_role(auth.uid(), ''admin'')');
  SELECT pg_get_functiondef('public.time_clock_admin_create_entry(uuid,text,timestamptz,text,uuid,text,text)'::regprocedure) INTO v_def;
  EXECUTE replace(v_def, 'IF NOT (public.rz_admin_of_employee(_employee_id) OR (public.has_timeclock_permission(auth.uid(), ''execute'', ''edit'') AND public.rz_member_of_employee_company(_employee_id))) THEN', 'IF NOT public.has_timeclock_permission(auth.uid(), ''execute'', ''edit'') THEN');
  FOREACH v_fn IN ARRAY ARRAY['time_clock_admin_set_status(uuid,text,text)', 'time_clock_admin_update_entry(uuid,text,timestamptz,text,text,text)'] LOOP
    SELECT pg_get_functiondef(v_fn::regprocedure) INTO v_def;
    EXECUTE replace(v_def, 'IF NOT COALESCE((SELECT public.rz_admin_of_employee(t0.employee_id) OR (public.has_timeclock_permission(auth.uid(), ''execute'', ''edit'') AND public.rz_member_of_employee_company(t0.employee_id)) FROM public.time_clock_entries t0 WHERE t0.id = _entry_id), false) THEN', 'IF NOT public.has_timeclock_permission(auth.uid(), ''execute'', ''edit'') THEN');
  END LOOP;
  SELECT pg_get_functiondef('public.time_clock_admin_review(uuid[],text,text)'::regprocedure) INTO v_def;
  EXECUTE replace(v_def, 'IF EXISTS (SELECT 1 FROM public.time_clock_entries t0 WHERE t0.id = ANY(_entry_ids) AND NOT (public.rz_admin_of_employee(t0.employee_id) OR (public.has_timeclock_permission(auth.uid(), ''execute'', ''edit'') AND public.rz_member_of_employee_company(t0.employee_id)))) THEN', 'IF NOT public.has_timeclock_permission(auth.uid(), ''execute'', ''edit'') THEN');
  SELECT pg_get_functiondef('public.time_clock_recent_punchers(integer)'::regprocedure) INTO v_def;
  EXECUTE replace(v_def, 'WHERE (public.rz_admin_of_employee(e.employee_id) OR (public.has_timeclock_permission(auth.uid(), ''view'') AND public.rz_member_of_employee_company(e.employee_id)))', 'WHERE public.has_timeclock_permission(auth.uid(), ''view'')');
  SELECT pg_get_functiondef('public.admin_task_people(uuid)'::regprocedure) INTO v_def;
  EXECUTE replace(v_def, 'IF NOT public.rz_is_company_admin(_company_id) THEN', 'IF NOT public.rz_is_admin() THEN');
  SELECT p.oid::regprocedure::text INTO v_fn FROM pg_proc p WHERE p.proname = 'admin_create_task' AND p.pronamespace = 'public'::regnamespace;
  SELECT pg_get_functiondef(v_fn::regprocedure) INTO v_def;
  EXECUTE replace(v_def, 'IF NOT public.rz_is_company_admin(_company_id) THEN', 'IF NOT public.rz_is_admin() THEN');
END
$fx$;
CREATE OR REPLACE FUNCTION public.admin_employee_last_sign_in()
 RETURNS TABLE(employee_id uuid, last_sign_in_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT e.id, u.last_sign_in_at
  FROM employees e
  LEFT JOIN auth.users u ON u.id = e.user_id
  WHERE has_role(auth.uid(), 'admin')
     OR EXISTS (
       SELECT 1 FROM admin_group_members m
       JOIN admin_groups g ON g.id = m.group_id AND g.is_active
       WHERE m.user_id = auth.uid()
     );
$function$;

DROP FUNCTION IF EXISTS public.rz_legal_global();
DROP FUNCTION IF EXISTS public.rz_feed_peer_companies();
DROP FUNCTION IF EXISTS public.rz_admin_of_employee_path(text);
DROP FUNCTION IF EXISTS public.rz_path_uuid(text);
DROP FUNCTION IF EXISTS public.rz_legal_scope_client(uuid);
DROP FUNCTION IF EXISTS public.rz_legal_scope(uuid);
DROP FUNCTION IF EXISTS public.rz_hr_of_employee(uuid);
DROP FUNCTION IF EXISTS public.rz_member_of_employee_company(uuid);
DROP FUNCTION IF EXISTS public.rz_admin_of_user(uuid);
DROP FUNCTION IF EXISTS public.rz_admin_of_mail_account(uuid);
DROP FUNCTION IF EXISTS public.rz_admin_of_event(uuid);
DROP FUNCTION IF EXISTS public.rz_admin_of_ticket(uuid);
DROP FUNCTION IF EXISTS public.rz_admin_of_assignment(uuid);
DROP FUNCTION IF EXISTS public.rz_admin_of_absence(uuid);
DROP FUNCTION IF EXISTS public.rz_admin_of_employee(uuid);
DROP FUNCTION IF EXISTS public.rz_is_platform_staff();
