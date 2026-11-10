-- Aniversários: publicação automática no Feed, aviso (com push) à equipa e ao aniversariante,
-- e lista dos próximos aniversários para o Workspace. A idade nunca sai daqui (só dia e mês).

-- 1. Publicações de sistema no Feed (sem autor): kind 'birthday' e a pessoa a quem diz respeito
ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'post';
ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS subject_id uuid;
ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS subject_day date;
CREATE UNIQUE INDEX IF NOT EXISTS feed_posts_birthday_once
  ON public.feed_posts (subject_id, subject_day) WHERE kind = 'birthday';

-- O tipo de linha muda: é preciso apagar e criar outra vez
DROP FUNCTION IF EXISTS public.feed_list_posts(timestamptz, integer);
CREATE FUNCTION public.feed_list_posts(_before timestamptz DEFAULT NULL, _limit integer DEFAULT 20)
RETURNS TABLE(id uuid, author_id uuid, body text, audience text, department text,
              attachments jsonb, created_at timestamptz, edited_at timestamptz,
              comment_count integer, reactions jsonb, kind text, subject_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, p.author_id, p.body, p.audience, p.department, p.attachments,
         p.created_at, p.edited_at,
         (SELECT count(*)::int FROM feed_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL),
         (SELECT coalesce(jsonb_agg(jsonb_build_object('emoji', r.emoji, 'count', r.n, 'mine', r.mine)
                                    ORDER BY r.n DESC), '[]'::jsonb)
            FROM (SELECT fr.emoji, count(*) AS n, bool_or(fr.user_id = auth.uid()) AS mine
                    FROM feed_reactions fr WHERE fr.post_id = p.id GROUP BY fr.emoji) r),
         p.kind, p.subject_id
  FROM feed_posts p
  WHERE public.feed_can_see(p.id)
    AND (_before IS NULL OR p.created_at < _before)
  ORDER BY p.created_at DESC
  LIMIT least(greatest(coalesce(_limit, 20), 1), 50);
$$;
REVOKE ALL ON FUNCTION public.feed_list_posts(timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_list_posts(timestamptz, integer) TO authenticated;

-- Comentários numa publicação de aniversário avisam o aniversariante (não há autor)
CREATE OR REPLACE FUNCTION public.notify_feed_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  post feed_posts;
BEGIN
  SELECT * INTO post FROM feed_posts p WHERE p.id = NEW.post_id;
  IF post.kind = 'birthday' THEN
    PERFORM rz_notify(post.subject_id, 'birthday',
      rz_first_name(NEW.author_id) || ' deu-lhe os parabéns 🎂',
      NEW.body, '/colaborador/feed?post=' || NEW.post_id, NEW.author_id);
  ELSE
    PERFORM rz_notify(post.author_id, 'feed_comment',
      rz_first_name(NEW.author_id) || ' comentou a sua publicação',
      NEW.body, '/colaborador/feed?post=' || NEW.post_id, NEW.author_id);
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Faz anos neste dia? (29/02 conta a 28/02 nos anos que não são bissextos)
CREATE OR REPLACE FUNCTION public.rz_is_birthday(_birth date, _day date)
RETURNS boolean LANGUAGE sql IMMUTABLE
AS $$
  SELECT _birth IS NOT NULL AND (
    (extract(month FROM _birth) = extract(month FROM _day)
       AND extract(day FROM _birth) = extract(day FROM _day))
    OR (extract(month FROM _birth) = 2 AND extract(day FROM _birth) = 29
        AND extract(month FROM _day) = 2 AND extract(day FROM _day) = 28
        AND extract(day FROM (date_trunc('year', _day) + interval '1 month 28 days')) <> 29)
  );
$$;

-- 3. Corre todos os dias às 08:00 (Lisboa): publica no Feed e avisa (uma vez por dia e pessoa)
CREATE OR REPLACE FUNCTION public.rz_birthdays_daily()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Europe/Lisbon')::date;
  person record;
  post_id uuid;
  first text;
  done integer := 0;
BEGIN
  -- O cron corre às 07:00 e 08:00 UTC (hora de verão/inverno); só publica a partir das 08:00
  IF extract(hour FROM now() AT TIME ZONE 'Europe/Lisbon') < 8 THEN
    RETURN 0;
  END IF;
  FOR person IN
    SELECT e.user_id, e.name, e.company_id
    FROM employees e
    WHERE coalesce(e.is_active, true) AND e.user_id IS NOT NULL AND e.company_id IS NOT NULL
      AND public.rz_is_birthday(e.birth_date, today)
  LOOP
    first := split_part(trim(person.name), ' ', 1);
    INSERT INTO feed_posts (company_id, author_id, body, audience, kind, subject_id, subject_day)
    VALUES (person.company_id, NULL,
            'Hoje é o aniversário de ' || trim(person.name) || '! 🎉' || chr(10) ||
            'Deixe-lhe os parabéns nos comentários. 🎂',
            'company', 'birthday', person.user_id, today)
    ON CONFLICT DO NOTHING
    RETURNING id INTO post_id;
    CONTINUE WHEN post_id IS NULL; -- já publicado hoje

    -- A equipa (mesma empresa, com conta)
    PERFORM rz_notify(c.user_id, 'birthday', 'Hoje é o aniversário de ' || first || ' 🎂',
                      'Dê-lhe os parabéns no Feed.', '/colaborador/feed?post=' || post_id, NULL)
    FROM employees c
    WHERE c.company_id = person.company_id AND coalesce(c.is_active, true)
      AND c.user_id IS NOT NULL AND c.user_id <> person.user_id;

    -- O próprio
    PERFORM rz_notify(person.user_id, 'birthday', 'Parabéns, ' || first || '! 🎂',
                      'Toda a equipa deseja-lhe um feliz aniversário.',
                      '/colaborador/feed?post=' || post_id, NULL);
    done := done + 1;
  END LOOP;
  RETURN done;
END;
$$;
REVOKE ALL ON FUNCTION public.rz_birthdays_daily() FROM PUBLIC, anon, authenticated;

-- 4. Próximos aniversários dos colegas (só dia e mês, nunca o ano/idade)
CREATE OR REPLACE FUNCTION public.rz_upcoming_birthdays(_days integer DEFAULT 7)
RETURNS TABLE(user_id uuid, name text, birthday date, days_until integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH me AS (
    SELECT company_id FROM employees WHERE user_id = auth.uid() AND coalesce(is_active, true) LIMIT 1
  ), today AS (SELECT (now() AT TIME ZONE 'Europe/Lisbon')::date AS d)
  SELECT e.user_id, trim(e.name), (t.d + n)::date, n
  FROM employees e, me, today t, generate_series(0, least(greatest(coalesce(_days, 7), 0), 31)) n
  WHERE e.company_id = me.company_id AND coalesce(e.is_active, true) AND e.user_id IS NOT NULL
    AND public.rz_is_birthday(e.birth_date, (t.d + n)::date)
  ORDER BY n, e.name;
$$;
REVOKE ALL ON FUNCTION public.rz_upcoming_birthdays(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_upcoming_birthdays(integer) TO authenticated;

-- 5. Agenda: 08:00 em Lisboa = 07:00 (verão) ou 08:00 UTC (inverno); a função só publica uma vez
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'rz-birthdays';
SELECT cron.schedule('rz-birthdays', '0 7,8 * * *', $$SELECT public.rz_birthdays_daily()$$);
