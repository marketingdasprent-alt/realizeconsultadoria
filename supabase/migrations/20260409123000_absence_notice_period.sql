-- Função para validar a antecedência mínima de 48h
CREATE OR REPLACE FUNCTION public.check_absence_notice_period()
RETURNS TRIGGER AS $$
BEGIN
  -- Permite que administradores ignorem a regra de 48h
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Verifica se a data de início é pelo menos 48h (2 dias inteiros) após a data atual
  -- Se hoje é dia 10, a data mínima permitida deve ser dia 12.
  IF NEW.start_date < (CURRENT_DATE + interval '2 days') THEN
    RAISE EXCEPTION 'ERRO: Os pedidos de ausência devem ser feitos com pelo menos 48 horas de antecedência.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para aplicar a validação antes de inserir
DROP TRIGGER IF EXISTS tr_check_absence_notice_period ON public.absences;
CREATE TRIGGER tr_check_absence_notice_period
  BEFORE INSERT ON public.absences
  FOR EACH ROW
  EXECUTE FUNCTION public.check_absence_notice_period();
