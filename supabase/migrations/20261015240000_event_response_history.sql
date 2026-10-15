-- Realize 2.0 · Convites do calendário: histórico de todas as respostas (Vou, Não vou,
-- Talvez), convites e retiradas, lido pelo admin (e pelo organizador do evento), e limite de
-- alterações: no máximo 5 mudanças de resposta por pessoa e evento em 10 minutos.

CREATE TABLE public.calendar_attendee_history (
  id bigserial PRIMARY KEY,
  event_id uuid NOT NULL,
  -- Cópias (o histórico fica mesmo que o evento seja apagado).
  event_title text,
  event_owner_id uuid,
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('convidado', 'resposta', 'retirado')),
  old_response text,
  new_response text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calendar_attendee_history_event ON public.calendar_attendee_history (event_id, changed_at);
CREATE INDEX calendar_attendee_history_user ON public.calendar_attendee_history (user_id, event_id, changed_at);
ALTER TABLE public.calendar_attendee_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Calendário: histórico (admin e organizador)" ON public.calendar_attendee_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR event_owner_id = auth.uid());
-- Ninguém escreve diretamente: só o trigger.
REVOKE ALL ON public.calendar_attendee_history FROM anon, authenticated;
GRANT SELECT ON public.calendar_attendee_history TO authenticated;
GRANT ALL ON public.calendar_attendee_history TO service_role;

CREATE FUNCTION public.calendar_attendee_audit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event uuid := coalesce(NEW.event_id, OLD.event_id);
  v_title text;
  v_owner uuid;
BEGIN
  SELECT title, owner_id INTO v_title, v_owner FROM calendar_events WHERE id = v_event;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO calendar_attendee_history
      (event_id, event_title, event_owner_id, user_id, action, new_response, changed_by)
    VALUES (v_event, v_title, v_owner, NEW.user_id, 'convidado', NEW.response, auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.response IS DISTINCT FROM OLD.response THEN
      INSERT INTO calendar_attendee_history
        (event_id, event_title, event_owner_id, user_id, action, old_response, new_response, changed_by)
      VALUES (v_event, v_title, v_owner, NEW.user_id, 'resposta', OLD.response, NEW.response, auth.uid());
    END IF;
  ELSE
    INSERT INTO calendar_attendee_history
      (event_id, event_title, event_owner_id, user_id, action, old_response, changed_by)
    VALUES (v_event, v_title, v_owner, OLD.user_id, 'retirado', OLD.response, auth.uid());
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$;
CREATE TRIGGER calendar_attendee_audit
  AFTER INSERT OR UPDATE OF response OR DELETE ON public.calendar_event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.calendar_attendee_audit();

-- Limite: 5 mudanças de resposta em 10 minutos por pessoa e evento (o próprio convidado).
CREATE FUNCTION public.calendar_response_rate_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.response IS DISTINCT FROM OLD.response AND auth.uid() = NEW.user_id THEN
    IF (SELECT count(*) FROM calendar_attendee_history
        WHERE event_id = NEW.event_id AND user_id = NEW.user_id AND action = 'resposta'
          AND changed_at > now() - interval '10 minutes') >= 5 THEN
      RAISE EXCEPTION 'rate_limited'
        USING ERRCODE = 'P0001',
              HINT = 'Demasiadas mudanças de resposta. Tente daqui a alguns minutos.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER calendar_response_rate_limit
  BEFORE UPDATE OF response ON public.calendar_event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.calendar_response_rate_limit();

REVOKE ALL ON FUNCTION public.calendar_attendee_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calendar_response_rate_limit() FROM PUBLIC, anon, authenticated;
