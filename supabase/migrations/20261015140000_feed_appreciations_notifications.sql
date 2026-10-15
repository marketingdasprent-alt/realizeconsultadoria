-- Realize 2.0 · Fase 2 — Feed (§12), Apreciações (§7) e Notificações (§18)
--
-- * Feed: publicações dos colaboradores (texto, imagens, documentos), comentários e reações,
--   visíveis à empresa inteira ou só ao departamento de quem publica. Os avisos dos RH
--   (tabela notifications) continuam iguais e aparecem no Feed como comunicados.
-- * Apreciações: reconhecimento entre colegas da mesma empresa, público ou privado.
-- * Notificações: caixa por utilizador (user_notifications), preenchida por triggers
--   (apreciação recebida, comentário numa publicação, decisões sobre ausências, tickets e
--   documentos). Os triggers nas tabelas existentes nunca bloqueiam a operação original.

-- 0. Diretório com o email profissional (para o perfil dos colegas) ---------------------

DROP FUNCTION IF EXISTS public.chat_directory();
CREATE FUNCTION public.chat_directory()
RETURNS TABLE (
  user_id uuid,
  employee_id uuid,
  name text,
  "position" text,
  department text,
  email text,
  company_id uuid,
  company_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.user_id, e.id, e.name, e.position, e.department, e.email, e.company_id, c.name
  FROM employees e
  JOIN companies c ON c.id = e.company_id
  WHERE e.is_active
    AND e.user_id IS NOT NULL
    AND e.company_id = (SELECT me.company_id FROM employees me
                        WHERE me.user_id = auth.uid() AND me.is_active LIMIT 1)
  ORDER BY e.name;
$$;
REVOKE ALL ON FUNCTION public.chat_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_directory() TO authenticated;

-- 1. Feed --------------------------------------------------------------------------------

CREATE TABLE public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text CHECK (body IS NULL OR char_length(body) <= 5000),
  audience text NOT NULL DEFAULT 'company' CHECK (audience IN ('company', 'department')),
  department text,
  -- [{ path, name, size, mime }] no bucket privado feed-files ("<publicação>/<ficheiro>").
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  CHECK (audience = 'company' OR department IS NOT NULL)
);
CREATE INDEX feed_posts_company_created ON public.feed_posts (company_id, created_at DESC);

CREATE TABLE public.feed_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX feed_comments_post ON public.feed_comments (post_id, created_at);

CREATE TABLE public.feed_reactions (
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, emoji)
);

/** Pode ver a publicação: mesma empresa e (toda a empresa, o seu departamento ou é o autor). */
CREATE OR REPLACE FUNCTION public.feed_can_see(_post_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM feed_posts p
    JOIN employees me ON me.user_id = auth.uid() AND me.is_active AND me.company_id = p.company_id
    WHERE p.id = _post_id
      AND p.deleted_at IS NULL
      AND (p.audience = 'company' OR p.department = me.department OR p.author_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.feed_is_author(_post_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM feed_posts p
    WHERE p.id = _post_id AND p.author_id = auth.uid() AND p.deleted_at IS NULL
  );
$$;

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feed: ver publicações" ON public.feed_posts
  FOR SELECT TO authenticated USING (public.feed_can_see(id));
CREATE POLICY "Feed: publicar" ON public.feed_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.employees me
      WHERE me.user_id = auth.uid() AND me.is_active AND me.company_id = feed_posts.company_id
        AND (feed_posts.audience = 'company' OR feed_posts.department = me.department)
    )
  );
CREATE POLICY "Feed: o autor edita ou elimina" ON public.feed_posts
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
REVOKE UPDATE ON public.feed_posts FROM authenticated;
GRANT UPDATE (body, attachments, deleted_at) ON public.feed_posts TO authenticated;

CREATE POLICY "Feed: ver comentários" ON public.feed_comments
  FOR SELECT TO authenticated USING (public.feed_can_see(post_id));
CREATE POLICY "Feed: comentar" ON public.feed_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.feed_can_see(post_id));
CREATE POLICY "Feed: o autor elimina o comentário" ON public.feed_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
REVOKE UPDATE ON public.feed_comments FROM authenticated;
GRANT UPDATE (deleted_at) ON public.feed_comments TO authenticated;

CREATE POLICY "Feed: ver reações" ON public.feed_reactions
  FOR SELECT TO authenticated USING (public.feed_can_see(post_id));
CREATE POLICY "Feed: reagir" ON public.feed_reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.feed_can_see(post_id));
CREATE POLICY "Feed: retirar reação" ON public.feed_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.feed_posts_before_write()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.edited_at := NULL;
    NEW.deleted_at := NULL;
    IF NEW.audience = 'company' THEN
      NEW.department := NULL;
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'A publicação já foi eliminada';
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    NEW.deleted_at := now();
    NEW.body := NULL;
    NEW.attachments := '[]'::jsonb;
  ELSIF NEW.body IS DISTINCT FROM OLD.body THEN
    NEW.edited_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER feed_posts_before_write
  BEFORE INSERT OR UPDATE ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.feed_posts_before_write();

CREATE OR REPLACE FUNCTION public.feed_comments_before_insert()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.created_at := now();
  NEW.deleted_at := NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER feed_comments_before_insert
  BEFORE INSERT ON public.feed_comments
  FOR EACH ROW EXECUTE FUNCTION public.feed_comments_before_insert();

/** Publicações visíveis (mais recentes primeiro), com nº de comentários e reações agregadas. */
CREATE OR REPLACE FUNCTION public.feed_list_posts(_before timestamptz DEFAULT NULL, _limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  author_id uuid,
  body text,
  audience text,
  department text,
  attachments jsonb,
  created_at timestamptz,
  edited_at timestamptz,
  comment_count integer,
  reactions jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.author_id, p.body, p.audience, p.department, p.attachments,
         p.created_at, p.edited_at,
         (SELECT count(*)::int FROM feed_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL),
         (SELECT coalesce(jsonb_agg(jsonb_build_object('emoji', r.emoji, 'count', r.n, 'mine', r.mine)
                                    ORDER BY r.n DESC), '[]'::jsonb)
            FROM (SELECT fr.emoji, count(*) AS n, bool_or(fr.user_id = auth.uid()) AS mine
                    FROM feed_reactions fr WHERE fr.post_id = p.id GROUP BY fr.emoji) r)
  FROM feed_posts p
  WHERE public.feed_can_see(p.id)
    AND (_before IS NULL OR p.created_at < _before)
  ORDER BY p.created_at DESC
  LIMIT least(greatest(coalesce(_limit, 20), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.feed_can_see(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.feed_is_author(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.feed_list_posts(timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_can_see(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.feed_is_author(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.feed_list_posts(timestamptz, integer) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feed-files', 'feed-files', false, 15728640,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- chat_path_conversation devolve o primeiro segmento do caminho como uuid (aqui: a publicação).
CREATE POLICY "Feed: ver ficheiros" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'feed-files' AND public.feed_can_see(public.chat_path_conversation(name)));
CREATE POLICY "Feed: o autor envia ficheiros" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feed-files' AND public.feed_is_author(public.chat_path_conversation(name)));

-- 2. Apreciações ----------------------------------------------------------------------

CREATE TABLE public.appreciations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('great_work', 'team_spirit', 'creativity', 'leadership',
    'helpful', 'professional', 'innovation', 'dedication', 'congrats', 'thanks')),
  message text CHECK (message IS NULL OR char_length(message) <= 500),
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id IS DISTINCT FROM recipient_id)
);
CREATE INDEX appreciations_recipient ON public.appreciations (recipient_id, created_at DESC);
CREATE INDEX appreciations_company ON public.appreciations (company_id, created_at DESC);

ALTER TABLE public.appreciations ENABLE ROW LEVEL SECURITY;

-- Públicas: toda a empresa vê. Privadas: só quem enviou e quem recebeu.
CREATE POLICY "Apreciações: ver" ON public.appreciations
  FOR SELECT TO authenticated
  USING (
    (sender_id = auth.uid() OR recipient_id = auth.uid())
    OR (is_public AND EXISTS (
      SELECT 1 FROM public.employees me
      WHERE me.user_id = auth.uid() AND me.is_active AND me.company_id = appreciations.company_id
    ))
  );
CREATE POLICY "Apreciações: enviar a um colega" ON public.appreciations
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND recipient_id <> auth.uid()
    AND public.chat_is_colleague(recipient_id)
    AND company_id = (SELECT me.company_id FROM public.employees me
                      WHERE me.user_id = auth.uid() AND me.is_active LIMIT 1)
  );
CREATE POLICY "Apreciações: quem enviou pode retirar" ON public.appreciations
  FOR DELETE TO authenticated USING (sender_id = auth.uid());

CREATE OR REPLACE FUNCTION public.appreciations_before_insert()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER appreciations_before_insert
  BEFORE INSERT ON public.appreciations
  FOR EACH ROW EXECUTE FUNCTION public.appreciations_before_insert();

-- 3. Notificações ----------------------------------------------------------------------

CREATE TABLE public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('appreciation', 'feed_comment', 'absence', 'ticket', 'document')),
  title text NOT NULL,
  body text,
  -- Caminho na app a abrir (ex.: /colaborador/pedidos).
  link text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX user_notifications_user ON public.user_notifications (user_id, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notificações: as minhas" ON public.user_notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Notificações: marcar como lidas" ON public.user_notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE UPDATE ON public.user_notifications FROM authenticated;
GRANT UPDATE (read_at) ON public.user_notifications TO authenticated;

/** Cria uma notificação (só para triggers; nunca falha a operação que a originou). */
CREATE OR REPLACE FUNCTION public.rz_notify(
  _user_id uuid, _kind text, _title text, _body text, _link text, _actor_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR _user_id IS NOT DISTINCT FROM _actor_id THEN
    RETURN;
  END IF;
  INSERT INTO user_notifications (user_id, kind, title, body, link, actor_id)
  VALUES (_user_id, _kind, left(_title, 200), left(_body, 300), _link, _actor_id);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'rz_notify falhou: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.rz_notify(uuid, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;

/** Primeiro nome de um utilizador (colaborador). */
CREATE OR REPLACE FUNCTION public.rz_first_name(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(split_part((SELECT e.name FROM employees e WHERE e.user_id = _user_id LIMIT 1), ' ', 1), 'Alguém');
$$;
REVOKE ALL ON FUNCTION public.rz_first_name(uuid) FROM PUBLIC, anon, authenticated;

-- Apreciação recebida
CREATE OR REPLACE FUNCTION public.notify_appreciation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM rz_notify(
    NEW.recipient_id, 'appreciation',
    rz_first_name(NEW.sender_id) || ' reconheceu o seu trabalho',
    coalesce(NEW.message, CASE NEW.kind
      WHEN 'great_work' THEN 'Excelente trabalho' WHEN 'team_spirit' THEN 'Espírito de equipa'
      WHEN 'creativity' THEN 'Criatividade' WHEN 'leadership' THEN 'Liderança'
      WHEN 'helpful' THEN 'Ajuda importante' WHEN 'professional' THEN 'Profissionalismo'
      WHEN 'innovation' THEN 'Inovação' WHEN 'dedication' THEN 'Dedicação'
      WHEN 'congrats' THEN 'Parabéns' ELSE 'Obrigado' END),
    '/colaborador/apreciacoes', NEW.sender_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER notify_appreciation AFTER INSERT ON public.appreciations
  FOR EACH ROW EXECUTE FUNCTION public.notify_appreciation();

-- Comentário numa publicação minha
CREATE OR REPLACE FUNCTION public.notify_feed_comment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM rz_notify(
    (SELECT p.author_id FROM feed_posts p WHERE p.id = NEW.post_id), 'feed_comment',
    rz_first_name(NEW.author_id) || ' comentou a sua publicação',
    NEW.body, '/colaborador/feed?post=' || NEW.post_id, NEW.author_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER notify_feed_comment AFTER INSERT ON public.feed_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_feed_comment();

-- Decisão sobre um pedido de ausência (tabela existente; não bloqueia a decisão)
CREATE OR REPLACE FUNCTION public.notify_absence_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_type text := CASE NEW.absence_type
    WHEN 'vacation' THEN 'férias' WHEN 'sick_leave' THEN 'baixa médica'
    WHEN 'appointment' THEN 'consulta' WHEN 'personal_leave' THEN 'licença pessoal'
    WHEN 'maternity' THEN 'licença de maternidade' WHEN 'paternity' THEN 'licença de paternidade'
    WHEN 'training' THEN 'formação' ELSE 'ausência' END;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('approved', 'rejected', 'partially_approved') THEN
    PERFORM rz_notify(
      (SELECT e.user_id FROM employees e WHERE e.id = NEW.employee_id), 'absence',
      CASE NEW.status
        WHEN 'approved' THEN 'Pedido de ' || v_type || ' aprovado'
        WHEN 'rejected' THEN 'Pedido de ' || v_type || ' rejeitado'
        ELSE 'Pedido de ' || v_type || ' aprovado em parte' END,
      to_char(NEW.start_date, 'DD/MM') || ' a ' || to_char(NEW.end_date, 'DD/MM/YYYY'),
      '/colaborador/pedidos', auth.uid());
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
CREATE TRIGGER notify_absence_status AFTER UPDATE OF status ON public.absences
  FOR EACH ROW EXECUTE FUNCTION public.notify_absence_status();

-- Ticket: mudança de estado e respostas dos RH
CREATE OR REPLACE FUNCTION public.notify_ticket_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM rz_notify(
      (SELECT e.user_id FROM employees e WHERE e.id = NEW.employee_id), 'ticket',
      CASE NEW.status
        WHEN 'in_progress' THEN 'Ticket em progresso'
        WHEN 'resolved' THEN 'Ticket resolvido'
        WHEN 'closed' THEN 'Ticket fechado'
        ELSE 'Ticket reaberto' END,
      NEW.subject, '/colaborador/tickets', auth.uid());
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
CREATE TRIGGER notify_ticket_status AFTER UPDATE OF status ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_status();

CREATE OR REPLACE FUNCTION public.notify_ticket_reply()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.sender_role, '') <> 'employee' THEN
    PERFORM rz_notify(
      (SELECT e.user_id FROM support_tickets t JOIN employees e ON e.id = t.employee_id
        WHERE t.id = NEW.ticket_id), 'ticket',
      'Nova resposta dos RH',
      (SELECT t.subject FROM support_tickets t WHERE t.id = NEW.ticket_id),
      '/colaborador/tickets', NEW.user_id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
CREATE TRIGGER notify_ticket_reply AFTER INSERT ON public.support_ticket_replies
  FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_reply();

-- Documentos: novo documento da empresa e decisão sobre um documento enviado
CREATE OR REPLACE FUNCTION public.notify_employee_document()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := (SELECT e.user_id FROM employees e WHERE e.id = NEW.employee_id);
BEGIN
  IF TG_OP = 'INSERT' AND coalesce(NEW.uploaded_by_role, '') <> 'employee' THEN
    PERFORM rz_notify(v_user, 'document',
      CASE WHEN NEW.category = 'recibo_vencimento' THEN 'Novo recibo de vencimento'
           ELSE 'Novo documento disponível' END,
      NEW.file_name, '/colaborador/documentos', NEW.uploaded_by);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
        AND coalesce(NEW.uploaded_by_role, '') = 'employee'
        AND NEW.status IN ('approved', 'rejected') THEN
    PERFORM rz_notify(v_user, 'document',
      CASE NEW.status WHEN 'approved' THEN 'Documento aprovado' ELSE 'Documento rejeitado' END,
      coalesce(NEW.review_notes, NEW.file_name), '/colaborador/documentos', NEW.reviewed_by);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
CREATE TRIGGER notify_employee_document AFTER INSERT OR UPDATE OF status ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.notify_employee_document();

-- 4. Tempo real ------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime
  ADD TABLE public.feed_posts, public.feed_comments, public.user_notifications;
