-- Realize 2.0 · Verificação de email novo com menos escritas na BD (plano Nano).
-- Antes cada passagem fazia 2 UPDATE por caixa: a reserva em mail_accounts.polled_at e o
-- notified_until, que se regravava sempre (~2100 por hora com 20 caixas, 24 h por dia).
-- Agora a mail-api reserva a passagem inteira numa só linha (mail_poll_claim) e grava
-- notified_until só quando chega email. As IMAP continuam no máximo a cada 2 minutos.
-- Aplicar ANTES de publicar a mail-api nova (que chama mail_poll_claim).
-- mail_accounts.polled_at deixa de ser usado (fica, sem dados novos).

CREATE TABLE IF NOT EXISTS public.mail_poll_lease (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  locked_until timestamptz NOT NULL DEFAULT '-infinity',
  imap_polled_at timestamptz NOT NULL DEFAULT '-infinity'
);
INSERT INTO public.mail_poll_lease (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.mail_poll_lease ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mail_poll_lease FROM anon, authenticated;
GRANT ALL ON public.mail_poll_lease TO service_role;

-- Reserva a passagem por p_lease_seconds (atómico: uma segunda chamada nesse tempo recebe
-- claimed = false) e diz se as caixas IMAP entram nesta (a última vez foi há mais de
-- p_imap_gap_seconds). Um só UPDATE de uma linha por passagem.
CREATE OR REPLACE FUNCTION public.mail_poll_claim(p_lease_seconds integer, p_imap_gap_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_imap boolean;
BEGIN
  UPDATE mail_poll_lease
  SET locked_until = now() + make_interval(secs => p_lease_seconds),
      imap_polled_at = CASE
        WHEN imap_polled_at < now() - make_interval(secs => p_imap_gap_seconds) THEN now()
        ELSE imap_polled_at
      END
  WHERE id AND locked_until < now()
  RETURNING imap_polled_at = now() INTO v_imap;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed', false, 'imap', false);
  END IF;
  RETURN jsonb_build_object('claimed', true, 'imap', v_imap);
END;
$$;

REVOKE ALL ON FUNCTION public.mail_poll_claim(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mail_poll_claim(integer, integer) TO service_role;
