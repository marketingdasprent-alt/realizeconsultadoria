-- Marcar pessoas no Feed (@Nome) nas publicações e nos comentários: quem é marcado recebe um
-- aviso (com push), se puder ver a publicação.

ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.feed_comments ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';

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

-- Avisa os marcados (no máx. 30), só quem pode ver a publicação e sem repetir avisos
CREATE OR REPLACE FUNCTION public.feed_notify_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  post feed_posts;
  target uuid;
  is_comment boolean := TG_TABLE_NAME = 'feed_comments';
  post_id uuid;
BEGIN
  IF coalesce(array_length(NEW.mentions, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;
  -- NEW.post_id só existe nos comentários (to_jsonb evita o erro de campo nas publicações)
  post_id := CASE WHEN is_comment THEN (to_jsonb(NEW) ->> 'post_id')::uuid ELSE NEW.id END;
  SELECT * INTO post FROM feed_posts p WHERE p.id = post_id;

  FOREACH target IN ARRAY (SELECT array_agg(DISTINCT u) FROM unnest(NEW.mentions[1:30]) u) LOOP
    CONTINUE WHEN target IS NOT DISTINCT FROM NEW.author_id;
    -- Num comentário, o autor da publicação (ou o aniversariante) já recebe o aviso do comentário
    CONTINUE WHEN is_comment AND target IS NOT DISTINCT FROM
      CASE WHEN post.kind = 'birthday' THEN post.subject_id ELSE post.author_id END;
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM employees e
      WHERE e.user_id = target AND coalesce(e.is_active, true) AND e.company_id = post.company_id
        AND (post.audience = 'company' OR public.rz_norm(post.department) = public.rz_norm(e.department))
    );
    PERFORM rz_notify(target, 'mention',
      rz_first_name(NEW.author_id) || ' marcou-o ' ||
        CASE WHEN is_comment THEN 'num comentário' ELSE 'numa publicação' END,
      coalesce(NEW.body, ''), '/colaborador/feed?post=' || post_id, NEW.author_id);
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'menções do Feed falharam: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feed_posts_notify_mentions ON public.feed_posts;
CREATE TRIGGER feed_posts_notify_mentions AFTER INSERT ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.feed_notify_mentions();
DROP TRIGGER IF EXISTS feed_comments_notify_mentions ON public.feed_comments;
CREATE TRIGGER feed_comments_notify_mentions AFTER INSERT ON public.feed_comments
  FOR EACH ROW EXECUTE FUNCTION public.feed_notify_mentions();
