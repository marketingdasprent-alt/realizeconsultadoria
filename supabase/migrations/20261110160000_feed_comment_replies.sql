-- Responder a comentários no Feed (um nível, como no Facebook/LinkedIn): parent_id aponta para o
-- comentário principal; quem escreveu esse comentário é avisado.
ALTER TABLE public.feed_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.feed_comments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS feed_comments_parent_idx ON public.feed_comments (parent_id);

-- Resposta a uma resposta fica no mesmo comentário principal; e tem de ser da mesma publicação
CREATE OR REPLACE FUNCTION public.feed_comments_before_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE
  parent feed_comments;
BEGIN
  NEW.created_at := now();
  NEW.deleted_at := NULL;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT * INTO parent FROM feed_comments c WHERE c.id = NEW.parent_id;
    IF parent.id IS NULL OR parent.post_id <> NEW.post_id THEN
      NEW.parent_id := NULL;
    ELSIF parent.parent_id IS NOT NULL THEN
      NEW.parent_id := parent.parent_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Avisos: resposta → quem escreveu o comentário; comentário → autor da publicação / aniversariante
CREATE OR REPLACE FUNCTION public.notify_feed_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  post feed_posts;
  parent_author uuid;
  owner uuid;
BEGIN
  SELECT * INTO post FROM feed_posts p WHERE p.id = NEW.post_id;
  owner := CASE WHEN post.kind = 'birthday' THEN post.subject_id ELSE post.author_id END;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT c.author_id INTO parent_author FROM feed_comments c WHERE c.id = NEW.parent_id;
    PERFORM rz_notify(parent_author, 'feed_comment',
      rz_first_name(NEW.author_id) || ' respondeu ao seu comentário',
      NEW.body, '/colaborador/feed?post=' || NEW.post_id, NEW.author_id);
  END IF;
  -- O dono da publicação também sabe (se não for ele quem respondeu nem o já avisado acima)
  IF owner IS DISTINCT FROM parent_author OR NEW.parent_id IS NULL THEN
    IF post.kind = 'birthday' THEN
      PERFORM rz_notify(owner, 'birthday',
        rz_first_name(NEW.author_id) || ' deu-lhe os parabéns 🎂',
        NEW.body, '/colaborador/feed?post=' || NEW.post_id, NEW.author_id);
    ELSE
      PERFORM rz_notify(owner, 'feed_comment',
        rz_first_name(NEW.author_id) || ' comentou a sua publicação',
        NEW.body, '/colaborador/feed?post=' || NEW.post_id, NEW.author_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
