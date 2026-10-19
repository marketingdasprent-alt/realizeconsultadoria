-- Realize 2.0 · Correções do Messenger
--  1. Fixar, silenciar e arquivar passam para uma tabela só do próprio (chat_member_settings):
--     em chat_members eram visíveis aos outros membros (leitura e tempo real).
--  2. Uma mensagem nova só desarquiva a conversa a quem não a silenciou.
--  3. Notificação push de mensagens novas (respeita o silenciar): trigger → push-send.
--  4. Canais efémeros (a escrever, reações, presença) passam a privados: só membros da
--     conversa / colegas da empresa os podem ouvir ou usar.
--  5. Quem envia um ficheiro pode apagá-lo (eliminar a mensagem apaga o anexo).
--  6. Pesquisa de mensagens sem distinguir acentos nem maiúsculas.

-- 1. Preferências pessoais de cada conversa --------------------------------------------------

CREATE TABLE public.chat_member_settings (
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_pinned boolean NOT NULL DEFAULT false,
  is_muted boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
ALTER TABLE public.chat_member_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat: ver as minhas preferências" ON public.chat_member_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Chat: criar as minhas preferências" ON public.chat_member_settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.chat_is_member(conversation_id));
CREATE POLICY "Chat: mudar as minhas preferências" ON public.chat_member_settings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

INSERT INTO public.chat_member_settings (conversation_id, user_id, is_pinned, is_muted, is_archived)
SELECT conversation_id, user_id, is_pinned, is_muted, is_archived
FROM public.chat_members
WHERE is_pinned OR is_muted OR is_archived;

-- 2. Nova mensagem: conversa atualizada, lida para quem enviou e desarquivada só para quem
--    não a silenciou (as silenciadas ficam no arquivo).
CREATE OR REPLACE FUNCTION public.chat_messages_after_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE chat_conversations
     SET last_message_at = NEW.created_at, last_message_id = NEW.id
   WHERE id = NEW.conversation_id;
  UPDATE chat_members
     SET last_read_at = NEW.created_at
   WHERE conversation_id = NEW.conversation_id AND user_id = NEW.sender_id;
  UPDATE chat_member_settings
     SET is_archived = false, updated_at = now()
   WHERE conversation_id = NEW.conversation_id AND is_archived
     AND (user_id = NEW.sender_id OR NOT is_muted);
  RETURN NEW;
END;
$$;

-- A lista lê as preferências da tabela nova (o resto igual).
CREATE OR REPLACE FUNCTION public.chat_list_conversations()
RETURNS TABLE (
  id uuid,
  kind text,
  title text,
  is_default boolean,
  created_at timestamptz,
  last_message_at timestamptz,
  my_role text,
  is_pinned boolean,
  is_muted boolean,
  is_archived boolean,
  member_count integer,
  unread integer,
  peer_user_id uuid,
  peer_name text,
  peer_position text,
  peer_department text,
  last_sender_id uuid,
  last_sender_name text,
  last_kind text,
  last_body text,
  last_attachment_name text,
  last_deleted boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.kind, c.title, c.is_default, c.created_at, c.last_message_at,
         m.role, coalesce(s.is_pinned, false), coalesce(s.is_muted, false),
         coalesce(s.is_archived, false),
         (SELECT count(*)::int FROM chat_members x WHERE x.conversation_id = c.id),
         (SELECT count(*)::int FROM chat_messages u
           WHERE u.conversation_id = c.id AND u.created_at > m.last_read_at
             AND u.sender_id IS DISTINCT FROM auth.uid() AND u.deleted_at IS NULL),
         peer.user_id, peer.name, peer.position, peer.department,
         lm.sender_id, sender.name, lm.kind, left(lm.body, 160), lm.attachment_name,
         lm.deleted_at IS NOT NULL
  FROM chat_members m
  JOIN chat_conversations c ON c.id = m.conversation_id
  LEFT JOIN chat_member_settings s ON s.conversation_id = m.conversation_id AND s.user_id = m.user_id
  LEFT JOIN LATERAL (
    SELECT e.user_id, e.name, e.position, e.department
    FROM chat_members pm JOIN employees e ON e.user_id = pm.user_id
    WHERE c.kind = 'direct' AND pm.conversation_id = c.id AND pm.user_id <> auth.uid()
    LIMIT 1
  ) peer ON true
  LEFT JOIN chat_messages lm ON lm.id = c.last_message_id
  LEFT JOIN LATERAL (
    SELECT e.name FROM employees e WHERE e.user_id = lm.sender_id LIMIT 1
  ) sender ON true
  WHERE m.user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM employees me WHERE me.user_id = auth.uid() AND me.is_active)
  ORDER BY coalesce(c.last_message_at, c.created_at) DESC;
$$;

-- As colunas antigas saem de chat_members (deixam de ser visíveis aos outros membros).
ALTER TABLE public.chat_members
  DROP COLUMN is_pinned,
  DROP COLUMN is_muted,
  DROP COLUMN is_archived;

-- Os outros dispositivos da mesma pessoa veem as mudanças logo.
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_member_settings;

-- 3. Push das mensagens novas -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rz_push_on_chat_message()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, net
AS $$
DECLARE
  v_token text;
BEGIN
  -- Só se algum outro membro (que não silenciou a conversa) tiver push ligado.
  IF NOT EXISTS (
    SELECT 1
    FROM chat_members m
    JOIN push_subscriptions p ON p.user_id = m.user_id
    LEFT JOIN chat_member_settings s
      ON s.conversation_id = m.conversation_id AND s.user_id = m.user_id
    WHERE m.conversation_id = NEW.conversation_id
      AND m.user_id IS DISTINCT FROM NEW.sender_id
      AND NOT coalesce(s.is_muted, false)
  ) THEN
    RETURN NEW;
  END IF;
  v_token := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'mail_system_token' LIMIT 1);
  IF v_token IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://jvvnsoasylusbmxfotci.supabase.co/functions/v1/push-send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-system-token', v_token),
    body := jsonb_build_object('chat_message_id', NEW.id),
    timeout_milliseconds := 15000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'push do chat falhou: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.rz_push_on_chat_message() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rz_push_on_chat_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.rz_push_on_chat_message();

-- 4. Canais privados do tempo real --------------------------------------------------------------
-- chat-conv-<conversa>: membros da conversa. chat-presence-<empresa>: colegas da empresa.
CREATE OR REPLACE FUNCTION public.rz_realtime_topic_allowed(_topic text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF _topic LIKE 'chat-conv-%' THEN
    BEGIN
      v_id := substring(_topic FROM 11)::uuid;
    EXCEPTION WHEN others THEN
      RETURN false;
    END;
    RETURN public.chat_is_member(v_id);
  ELSIF _topic LIKE 'chat-presence-%' THEN
    BEGIN
      v_id := substring(_topic FROM 15)::uuid;
    EXCEPTION WHEN others THEN
      RETURN false;
    END;
    RETURN EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid() AND is_active AND company_id = v_id
    );
  END IF;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.rz_realtime_topic_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rz_realtime_topic_allowed(text) TO authenticated;

CREATE POLICY "Realize: ouvir canais privados" ON realtime.messages
  FOR SELECT TO authenticated
  USING (public.rz_realtime_topic_allowed(realtime.topic()));
CREATE POLICY "Realize: enviar em canais privados" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (public.rz_realtime_topic_allowed(realtime.topic()));

-- 5. Eliminar uma mensagem apaga o ficheiro: quem o enviou pode apagá-lo -----------------------
CREATE POLICY "Chat: apagar os meus ficheiros" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-files'
    AND (owner = auth.uid() OR owner_id = auth.uid()::text)
  );

-- Os ZIP do Windows chegam como application/x-zip-compressed.
UPDATE storage.buckets
   SET allowed_mime_types = array(
     SELECT DISTINCT unnest(allowed_mime_types || ARRAY['application/x-zip-compressed'])
   )
 WHERE id = 'chat-files';

-- 6. Pesquisa nas mensagens (sem acentos nem maiúsculas; as regras de acesso aplicam-se) -----
CREATE OR REPLACE FUNCTION public.chat_search_messages(_term text, _limit integer DEFAULT 5)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT m.id, m.conversation_id, m.sender_id, m.body, m.created_at
  FROM chat_messages m
  WHERE m.deleted_at IS NULL
    AND m.body IS NOT NULL
    AND length(public.rz_norm(_term)) >= 2
    AND public.rz_norm(m.body) LIKE '%' || public.rz_norm(_term) || '%'
  ORDER BY m.created_at DESC
  LIMIT least(greatest(coalesce(_limit, 5), 1), 50);
$$;
REVOKE ALL ON FUNCTION public.chat_search_messages(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_search_messages(text, integer) TO authenticated;
