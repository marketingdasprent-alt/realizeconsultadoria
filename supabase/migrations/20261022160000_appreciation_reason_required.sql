-- Reconhecer o trabalho de alguém é sério: exige o motivo (qual trabalho foi reconhecido)
-- e tem limites para não virar spam. Só para novos registos; os antigos ficam como estão.
--   - motivo com pelo menos 30 caracteres;
--   - no máximo 3 reconhecimentos por pessoa e por dia;
--   - no máximo 1 por dia à mesma pessoa.
CREATE OR REPLACE FUNCTION public.appreciations_before_insert()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.created_at := now();
  NEW.message := nullif(btrim(NEW.message), '');
  IF NEW.message IS NULL OR char_length(NEW.message) < 30 THEN
    RAISE EXCEPTION 'appreciation_reason_required'
      USING ERRCODE = 'check_violation',
            HINT = 'Explique que trabalho está a reconhecer (mínimo 30 caracteres).';
  END IF;
  IF (SELECT count(*) FROM public.appreciations a
      WHERE a.sender_id = NEW.sender_id AND a.created_at > now() - interval '24 hours') >= 3 THEN
    RAISE EXCEPTION 'appreciation_daily_limit' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.appreciations a
             WHERE a.sender_id = NEW.sender_id AND a.recipient_id = NEW.recipient_id
               AND a.created_at > now() - interval '24 hours') THEN
    RAISE EXCEPTION 'appreciation_recipient_limit' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
