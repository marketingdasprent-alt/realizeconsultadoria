-- Reverte o Lote 3 (leitura do Feed pelo grupo): volta às policies e a feed_list_posts anteriores.
--
-- Não desfaz o backfill de 'feed.read' nos grupos (não há como distinguir o que o super admin ligou
-- depois): sem as funções novas essa capacidade deixa de ter efeito no Feed. Repõe o default da coluna
-- default_capabilities para '{}'.
--
-- ATENÇÃO: reaplicar a migração depois deste rollback volta a correr o backfill (volta a ligar
-- 'feed.read' em todos os grupos, incluindo os que o super admin tenha desligado entretanto).
--
-- Aplicar no SQL Editor, numa única chamada.

DROP POLICY IF EXISTS "Feed: ver publicações" ON public.feed_posts;
CREATE POLICY "Feed: ver publicações" ON public.feed_posts
  FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR author_id = auth.uid())
    AND public.feed_can_see_row(company_id, audience, department, author_id)
  );

DROP POLICY IF EXISTS "Feed: ver comentários" ON public.feed_comments;
CREATE POLICY "Feed: ver comentários" ON public.feed_comments
  FOR SELECT TO authenticated USING (public.feed_can_see(post_id));

DROP POLICY IF EXISTS "Feed: ver reações" ON public.feed_reactions;
CREATE POLICY "Feed: ver reações" ON public.feed_reactions
  FOR SELECT TO authenticated USING (public.feed_can_see(post_id));

DROP POLICY IF EXISTS "Feed: ver ficheiros" ON storage.objects;
CREATE POLICY "Feed: ver ficheiros" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'feed-files' AND public.feed_can_see(public.chat_path_conversation(name)));

DROP FUNCTION IF EXISTS public.feed_list_posts(timestamptz, integer);
CREATE FUNCTION public.feed_list_posts(_before timestamptz DEFAULT NULL, _limit integer DEFAULT 20)
RETURNS TABLE(id uuid, author_id uuid, body text, audience text, department text,
              attachments jsonb, created_at timestamptz, edited_at timestamptz,
              comment_count integer, reactions jsonb, kind text, subject_id uuid, mentions uuid[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, p.author_id, p.body, p.audience, p.department, p.attachments,
         p.created_at, p.edited_at,
         (SELECT count(*)::int FROM feed_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL),
         (SELECT coalesce(jsonb_agg(jsonb_build_object('emoji', r.emoji, 'count', r.n, 'mine', r.mine)
                                    ORDER BY r.n DESC), '[]'::jsonb)
            FROM (SELECT fr.emoji, count(*) AS n, bool_or(fr.user_id = auth.uid()) AS mine
                    FROM feed_reactions fr WHERE fr.post_id = p.id GROUP BY fr.emoji) r),
         p.kind, p.subject_id, p.mentions
  FROM feed_posts p
  WHERE public.feed_can_see(p.id)
    AND (_before IS NULL OR p.created_at < _before)
  ORDER BY p.created_at DESC
  LIMIT least(greatest(coalesce(_limit, 20), 1), 50);
$$;
REVOKE ALL ON FUNCTION public.feed_list_posts(timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_list_posts(timestamptz, integer) TO authenticated;

DROP FUNCTION IF EXISTS public.feed_post_people(uuid);
DROP FUNCTION IF EXISTS public.feed_can_read(uuid);
DROP FUNCTION IF EXISTS public.feed_can_read_row(uuid, text, text, uuid);
DROP FUNCTION IF EXISTS public.rz_group_peer_companies(text);

ALTER TABLE public.company_groups ALTER COLUMN default_capabilities SET DEFAULT '{}';
