-- Inclui o aniversariante (subject_id) em feed_post_people(p_post_id).
--
-- Posts automáticos de aniversário têm author_id = NULL e subject_id = aniversariante.
-- Quando o post vem de outra empresa do grupo, o aniversariante não está no diretório
-- da empresa de quem lê; incluí-lo em feed_post_people permite mostrar "Nome - Empresa"
-- em vez de "Antigo colaborador".
--
-- Só aditiva, idempotente (CREATE OR REPLACE com a mesma assinatura de retorno).
-- Reversão: supabase/rollbacks/20261120140000_feed_post_people_subject_rollback.sql
-- Ensaio (transação anulada): supabase/tests/multiempresa_lote3_ensaio.sql

CREATE OR REPLACE FUNCTION public.feed_post_people(p_post_id uuid)
 RETURNS TABLE(user_id uuid, name text, company_id uuid, company_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH ids AS (
    SELECT p.author_id AS uid FROM public.feed_posts p WHERE p.id = p_post_id
    UNION
    SELECT p.subject_id FROM public.feed_posts p WHERE p.id = p_post_id AND p.subject_id IS NOT NULL
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
    ORDER BY (x.company_id = (SELECT fp.company_id FROM public.feed_posts fp WHERE fp.id = p_post_id)) DESC NULLS LAST,
             x.is_active DESC, x.created_at
    LIMIT 1
  ) e
  LEFT JOIN public.companies co ON co.id = e.company_id
  WHERE ids.uid IS NOT NULL
    AND public.feed_can_read(p_post_id);
$function$;

REVOKE ALL ON FUNCTION public.feed_post_people(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_post_people(uuid) TO authenticated;