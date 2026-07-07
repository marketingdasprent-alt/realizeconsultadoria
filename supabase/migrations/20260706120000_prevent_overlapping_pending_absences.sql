-- Impedir dois pedidos de ausencia sobrepostos enquanto um continua pendente.
--
-- Um colaborador nao pode criar um novo pedido que cubra datas de um pedido seu
-- ainda "pendente" (por aprovar/recusar). Assim que o primeiro for aprovado ou
-- recusado, um novo pedido nessas datas passa a ser permitido.
--
-- Administradores estao isentos (tal como na regra das 48h), para poderem fazer
-- marcacoes -- incluindo em massa -- sem esta restricao.

CREATE OR REPLACE FUNCTION public.check_overlapping_pending_absence()
RETURNS TRIGGER AS $$
BEGIN
  -- Administradores podem criar livremente.
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.absences a
    WHERE a.employee_id = NEW.employee_id
      AND a.id <> NEW.id
      AND a.status = 'pending'
      AND NEW.start_date <= a.end_date
      AND NEW.end_date >= a.start_date
  ) THEN
    RAISE EXCEPTION 'Ja tem um pedido pendente para essas datas. Aguarde a aprovacao ou recusa antes de submeter outro.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

DROP TRIGGER IF EXISTS tr_check_overlapping_pending_absence ON public.absences;
CREATE TRIGGER tr_check_overlapping_pending_absence
  BEFORE INSERT ON public.absences
  FOR EACH ROW
  EXECUTE FUNCTION public.check_overlapping_pending_absence();
