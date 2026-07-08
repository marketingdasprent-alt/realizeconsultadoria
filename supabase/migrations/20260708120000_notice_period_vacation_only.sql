-- A antecedencia minima de 48h passa a aplicar-se APENAS a Ferias (vacation).
--
-- Antes, a regra bloqueava QUALQUER tipo de ausencia marcado com menos de 48h.
-- Isso impedia, por exemplo, marcar uma baixa medica no proprio dia -- o que nao
-- faz sentido: ninguem escolhe adoecer com 2 dias de antecedencia.
--
-- Agora so as Ferias exigem 48h de antecedencia. Todos os outros tipos
-- (baixa medica, consultas, licencas, formacao, etc.) podem ser marcados a
-- qualquer momento. Administradores continuam isentos.

CREATE OR REPLACE FUNCTION public.check_absence_notice_period()
RETURNS TRIGGER AS $$
BEGIN
  -- Administradores ignoram a regra.
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- 48h (2 dias inteiros) de antecedencia SO para Ferias.
  IF NEW.absence_type = 'vacation'
     AND NEW.start_date < (CURRENT_DATE + interval '2 days') THEN
    RAISE EXCEPTION 'ERRO: Os pedidos de ferias devem ser feitos com pelo menos 48 horas de antecedencia.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

DROP TRIGGER IF EXISTS tr_check_absence_notice_period ON public.absences;
CREATE TRIGGER tr_check_absence_notice_period
  BEFORE INSERT ON public.absences
  FOR EACH ROW
  EXECUTE FUNCTION public.check_absence_notice_period();
