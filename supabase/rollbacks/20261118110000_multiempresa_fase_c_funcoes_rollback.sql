-- Reversão da Fase C1 multiempresa. NÃO é uma migração: não corre sozinha; executar à mão.
-- Remove só o que a migração 20261118110000 criou. Não mexe em dados: as fichas já movidas ficam
-- na empresa de destino, e as pertenças e a auditoria já escritas mantêm-se.

-- Políticas aditivas de histórico (o colaborador volta a ver as ausências só pela empresa atual).
DROP POLICY IF EXISTS "Colaborador vê os seus períodos de ausência (qualquer empresa)" ON public.absence_periods;
DROP POLICY IF EXISTS "Colaborador vê as suas ausências (qualquer empresa)" ON public.absences;

-- Funções (a em massa primeiro, porque chama a individual).
DROP FUNCTION IF EXISTS public.rz_transfer_employees(uuid[], uuid);
DROP FUNCTION IF EXISTS public.rz_transfer_employee(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.rz_add_company_admin(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.rz_remove_company_admin(uuid, uuid);
DROP FUNCTION IF EXISTS public.rz_create_company(text, text, text, uuid, text, uuid);
