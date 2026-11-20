-- Multiempresa, Lote 3: leitura do Feed pelo grupo de empresas. SÓ LEITURA.
--
-- Regra (decisão do utilizador): quem está numa empresa que pertence a um grupo ativo com 'feed.read'
-- em default_capabilities vê, além do Feed da própria empresa (regra atual, incluindo departamento),
-- as publicações "para toda a empresa" (audience = 'company', não eliminadas, incluindo as automáticas de
-- aniversário) das outras empresas desse grupo. Sem grupo, ou grupo de uma só empresa: comportamento atual.
-- Publicações de departamento nunca saem da própria empresa. Se a empresa estiver em mais de um grupo
-- ativo, vale a união dos pares (a regra "uma empresa por grupo" é outra dívida: não se resolve aqui).
--
-- A empresa da pessoa vem das pertenças ativas (rz_my_company_ids, que usa rz_identity_ids), não só de
-- employees.company_id: contas fundidas e admins sem ficha contam.
--
-- ESCRITA NÃO MUDA. feed_can_see(post_id) e feed_can_see_row(...) ficam exatamente como estão: são a
-- regra de comentar, reagir e de enviar ficheiros (o INSERT usa feed_can_see). O que muda é só o ler:
--   * novas feed_can_read(post_id) e feed_can_read_row(...) = regra atual OU publicação de empresa par;
--   * usadas nas policies de SELECT de feed_posts, feed_comments, feed_reactions e storage "Feed: ver
--     ficheiros", e em feed_list_posts. As policies de INSERT/UPDATE/DELETE não são tocadas.
--   * feed_unread_count (invoker) não muda: conta através da RLS de feed_posts e passa a incluir as
--     publicações dos pares.
--
-- Publicações de aniversário (kind = 'birthday') também saem para os pares (decisão do utilizador: "é como
-- um post"). O corpo só tem o nome e "Hoje é o aniversário de ..."; nunca o ano de nascimento nem a idade.
-- O cartão lateral de aniversários (rz_upcoming_birthdays) NÃO muda neste lote.
--
-- feed_post_people(post): nome e empresa de quem escreveu, comentou ou reagiu numa publicação que a
-- pessoa pode ler (as pessoas de outra empresa não estão no diretório). Nunca devolve email, telefone,
-- cargo nem departamento.
--
-- Mudanças de dados:
--   * company_groups.default_capabilities passa a nascer com {feed.read} (antes {}), e os grupos que
--     já existem recebem 'feed.read' UMA vez (só na primeira aplicação desta migração; repetir não volta
--     a ligar o que o super admin tiver desligado).
--   * rz_create_group já tinha 'feed.read' por defeito no argumento: não é alterada.
--   ATENÇÃO: as publicações atuais de cada empresa (hoje 12 com empresa) ficam visíveis aos pares do
--   grupo assim que esta migração for aplicada, enquanto 'feed.read' estiver ligado no grupo.
--
-- feed_list_posts passa a devolver também company_id, company_name e author_name (o nome do autor: as
-- pessoas de outra empresa não estão no diretório de colegas). DROP + CREATE: o tipo de retorno muda. A app atual lê por nome, por isso não parte.
--
-- Só aditiva, repetível. Reversão: supabase/rollbacks/20261120120000_multiempresa_lote3_feed_grupo_rollback.sql
-- Ensaio (transação anulada): supabase/tests/multiempresa_lote3_ensaio.sql
-- NÃO aplicar sem autorização. Aplicar no SQL Editor, numa única chamada.

-- ============================================================================================
-- 1. Grupos: 'feed.read' por defeito
-- ============================================================================================
DO $backfill$
BEGIN
  -- Só na primeira aplicação (a função de pares ainda não existe).
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'rz_group_peer_companies'
  ) THEN
    UPDATE public.company_groups
       SET default_capabilities = array_append(default_capabilities, 'feed.read')
     WHERE NOT ('feed.read' = ANY (default_capabilities));
  END IF;
END
$backfill$;

ALTER TABLE public.company_groups
  ALTER COLUMN default_capabilities SET DEFAULT ARRAY['feed.read']::text[];

-- ============================================================================================
-- 2. Empresas pares (interna)
-- ============================================================================================
-- As empresas ativas dos grupos ativos das MINHAS empresas, em que o grupo tem p_cap. Exclui as minhas.
CREATE OR REPLACE FUNCTION public.rz_group_peer_companies(p_cap text)
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH mine AS (SELECT public.rz_my_company_ids() AS ids)
  SELECT coalesce(array_agg(DISTINCT m2.company_id), ARRAY[]::uuid[])
  FROM mine
  JOIN public.company_group_members m1
    ON m1.status = 'ativo' AND m1.company_id = ANY (mine.ids)
  JOIN public.company_groups g
    ON g.id = m1.group_id AND p_cap = ANY (g.default_capabilities)
  JOIN public.company_group_members m2
    ON m2.group_id = m1.group_id AND m2.status = 'ativo' AND NOT (m2.company_id = ANY (mine.ids))
  JOIN public.companies c
    ON c.id = m2.company_id AND c.is_active;
$function$;

REVOKE ALL ON FUNCTION public.rz_group_peer_companies(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rz_group_peer_companies(text) TO service_role;

-- ============================================================================================
-- 3. Ler (novas). feed_can_see e feed_can_see_row NÃO se alteram.
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.feed_can_read_row(
  _company_id uuid, _audience text, _department text, _author_id uuid
)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.feed_can_see_row(_company_id, _audience, _department, _author_id)
      OR (_audience = 'company'
          AND _company_id = ANY (public.rz_group_peer_companies('feed.read')));
$function$;

CREATE OR REPLACE FUNCTION public.feed_can_read(_post_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.feed_can_see(_post_id)
      OR EXISTS (
        SELECT 1 FROM public.feed_posts p
         WHERE p.id = _post_id
           AND p.deleted_at IS NULL
           AND p.audience = 'company'
           AND p.company_id = ANY (public.rz_group_peer_companies('feed.read'))
      );
$function$;

REVOKE ALL ON FUNCTION public.feed_can_read_row(uuid, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.feed_can_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_can_read_row(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.feed_can_read(uuid) TO authenticated;

-- ============================================================================================
-- 4. Policies de SELECT (as de escrita ficam)
-- ============================================================================================
DROP POLICY IF EXISTS "Feed: ver publicações" ON public.feed_posts;
CREATE POLICY "Feed: ver publicações" ON public.feed_posts
  FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR author_id = auth.uid())
    AND public.feed_can_read_row(company_id, audience, department, author_id)
  );

DROP POLICY IF EXISTS "Feed: ver comentários" ON public.feed_comments;
CREATE POLICY "Feed: ver comentários" ON public.feed_comments
  FOR SELECT TO authenticated USING (public.feed_can_read(post_id));

DROP POLICY IF EXISTS "Feed: ver reações" ON public.feed_reactions;
CREATE POLICY "Feed: ver reações" ON public.feed_reactions
  FOR SELECT TO authenticated USING (public.feed_can_read(post_id));

DROP POLICY IF EXISTS "Feed: ver ficheiros" ON storage.objects;
CREATE POLICY "Feed: ver ficheiros" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'feed-files' AND public.feed_can_read(public.chat_path_conversation(name)));

-- ============================================================================================
-- 5. feed_list_posts: lê pelo grupo e devolve a empresa
-- ============================================================================================
DROP FUNCTION IF EXISTS public.feed_list_posts(timestamptz, integer);
CREATE FUNCTION public.feed_list_posts(_before timestamptz DEFAULT NULL, _limit integer DEFAULT 20)
RETURNS TABLE(id uuid, author_id uuid, body text, audience text, department text,
              attachments jsonb, created_at timestamptz, edited_at timestamptz,
              comment_count integer, reactions jsonb, kind text, subject_id uuid, mentions uuid[],
              company_id uuid, company_name text, author_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT p.id, p.author_id, p.body, p.audience, p.department, p.attachments,
         p.created_at, p.edited_at,
         (SELECT count(*)::int FROM feed_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL),
         (SELECT coalesce(jsonb_agg(jsonb_build_object('emoji', r.emoji, 'count', r.n, 'mine', r.mine)
                                    ORDER BY r.n DESC), '[]'::jsonb)
            FROM (SELECT fr.emoji, count(*) AS n, bool_or(fr.user_id = auth.uid()) AS mine
                    FROM feed_reactions fr WHERE fr.post_id = p.id GROUP BY fr.emoji) r),
         p.kind, p.subject_id, p.mentions,
         p.company_id, co.name,
         (SELECT e.name FROM employees e WHERE e.user_id = p.author_id
           ORDER BY e.is_active DESC, e.created_at LIMIT 1)
  FROM feed_posts p
  LEFT JOIN companies co ON co.id = p.company_id
  WHERE public.feed_can_read(p.id)
    AND (_before IS NULL OR p.created_at < _before)
  ORDER BY p.created_at DESC
  LIMIT least(greatest(coalesce(_limit, 20), 1), 50);
$$;
REVOKE ALL ON FUNCTION public.feed_list_posts(timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_list_posts(timestamptz, integer) TO authenticated;

-- ============================================================================================
-- 6. Quem escreveu, comentou ou reagiu (nome e empresa, só de publicações que posso ler)
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.feed_post_people(p_post_id uuid)
 RETURNS TABLE(user_id uuid, name text, company_id uuid, company_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH ids AS (
    SELECT p.author_id AS uid FROM public.feed_posts p WHERE p.id = p_post_id
    UNION
    SELECT c.author_id FROM public.feed_comments c WHERE c.post_id = p_post_id AND c.deleted_at IS NULL
    UNION
    SELECT r.user_id FROM public.feed_reactions r WHERE r.post_id = p_post_id
  )
  SELECT e.user_id, trim(e.name), e.company_id, co.name
  FROM ids
  CROSS JOIN LATERAL (
    SELECT x.user_id, x.name, x.company_id
    FROM public.employees x
    WHERE x.user_id = ids.uid
    ORDER BY x.is_active DESC, x.created_at
    LIMIT 1
  ) e
  LEFT JOIN public.companies co ON co.id = e.company_id
  WHERE ids.uid IS NOT NULL
    AND public.feed_can_read(p_post_id);
$function$;

REVOKE ALL ON FUNCTION public.feed_post_people(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_post_people(uuid) TO authenticated;
