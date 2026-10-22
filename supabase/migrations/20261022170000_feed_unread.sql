-- Realize 2.0 · Feed: bolinha no menu com as novidades desde a última visita ao Feed
-- (publicações de colegas e reconhecimentos públicos). A última visita fica na BD, por pessoa,
-- para valer em todos os dispositivos.
CREATE TABLE public.feed_seen (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feed_seen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Feed: a minha última visita" ON public.feed_seen
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE ALL ON public.feed_seen FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.feed_seen TO authenticated;
GRANT ALL ON public.feed_seen TO service_role;

-- Novidades desde a última visita (a RLS decide o que a pessoa vê). Na primeira vez só marca
-- o ponto de partida: não despeja o histórico todo como "novo".
CREATE OR REPLACE FUNCTION public.feed_unread_count()
RETURNS integer
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE
  since timestamptz;
BEGIN
  SELECT seen_at INTO since FROM feed_seen WHERE user_id = auth.uid();
  IF since IS NULL THEN
    INSERT INTO feed_seen (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
    RETURN 0;
  END IF;
  RETURN (SELECT count(*) FROM feed_posts p
            WHERE p.deleted_at IS NULL AND p.created_at > since
              AND p.author_id IS DISTINCT FROM auth.uid())::integer
       + (SELECT count(*) FROM appreciations a
            WHERE a.is_public AND a.created_at > since
              AND a.sender_id IS DISTINCT FROM auth.uid())::integer;
END;
$$;

CREATE OR REPLACE FUNCTION public.feed_mark_seen()
RETURNS void
LANGUAGE sql SET search_path = public
AS $$
  INSERT INTO feed_seen (user_id, seen_at) VALUES (auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET seen_at = now();
$$;

REVOKE ALL ON FUNCTION public.feed_unread_count() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.feed_mark_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_unread_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.feed_mark_seen() TO authenticated;
