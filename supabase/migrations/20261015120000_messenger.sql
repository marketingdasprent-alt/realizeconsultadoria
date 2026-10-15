-- Realize 2.0 · Fase 2 — Messenger (briefing §5)
-- Conversas privadas, grupos e canais entre colaboradores da MESMA empresa, com ficheiros
-- privados (bucket chat-files) e tempo real. Os administradores não têm acesso às
-- conversas: só os membros leem as mensagens.
--
-- Também fecha duas fugas em employees (auditoria da Fase 0, §9):
--   * "Employees can view colleagues": cada colaborador lia a linha completa dos colegas
--     (IBAN, nº de documento, data de nascimento…). Passa a existir chat_directory(), só
--     com dados profissionais.
--   * "Employees can update own record": cada colaborador podia alterar a sua linha,
--     incluindo company_id. A app não usa esta escrita (só lê a própria linha).

-- 1. Privacidade em employees ---------------------------------------------------------

DROP POLICY IF EXISTS "Employees can view colleagues" ON public.employees;
DROP POLICY IF EXISTS "Employees can update own record" ON public.employees;

/** Colega ativo da mesma empresa que o utilizador autenticado (com conta). */
CREATE OR REPLACE FUNCTION public.chat_is_colleague(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.user_id = _user_id AND e.is_active
      AND e.company_id = (SELECT me.company_id FROM employees me
                          WHERE me.user_id = auth.uid() AND me.is_active LIMIT 1)
  );
$$;

/** Diretório de colegas: só dados profissionais, só a empresa do utilizador. */
CREATE OR REPLACE FUNCTION public.chat_directory()
RETURNS TABLE (
  user_id uuid,
  employee_id uuid,
  name text,
  "position" text,
  department text,
  company_id uuid,
  company_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.user_id, e.id, e.name, e.position, e.department, e.company_id, c.name
  FROM employees e
  JOIN companies c ON c.id = e.company_id
  WHERE e.is_active
    AND e.user_id IS NOT NULL
    AND e.company_id = (SELECT me.company_id FROM employees me
                        WHERE me.user_id = auth.uid() AND me.is_active LIMIT 1)
  ORDER BY e.name;
$$;

-- 2. Tabelas ----------------------------------------------------------------------------

CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('direct', 'group', 'channel', 'announcement')),
  title text CHECK (title IS NULL OR char_length(btrim(title)) BETWEEN 1 AND 80),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  -- Conversa privada: "userA:userB" (ordenados) — uma só por par.
  direct_key text UNIQUE,
  -- Canal "Geral" da empresa (um por empresa; todos os colaboradores entram).
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  last_message_id uuid
);
CREATE UNIQUE INDEX chat_conversations_default_channel
  ON public.chat_conversations (company_id) WHERE is_default;
CREATE INDEX chat_conversations_company ON public.chat_conversations (company_id);

CREATE TABLE public.chat_members (
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  is_pinned boolean NOT NULL DEFAULT false,
  is_muted boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX chat_members_user ON public.chat_members (user_id);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  -- O histórico fica mesmo que a conta seja apagada.
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'image', 'file', 'audio')),
  body text CHECK (body IS NULL OR char_length(body) <= 4000),
  attachment_path text,
  attachment_name text,
  attachment_size bigint,
  attachment_mime text,
  duration_sec numeric(6, 1),
  reply_to_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  CHECK (
    deleted_at IS NOT NULL
    OR (kind = 'text' AND body IS NOT NULL AND char_length(btrim(body)) > 0)
    OR (kind <> 'text' AND attachment_path IS NOT NULL)
  )
);
CREATE INDEX chat_messages_conversation ON public.chat_messages (conversation_id, created_at DESC);

ALTER TABLE public.chat_conversations
  ADD CONSTRAINT chat_conversations_last_message_fk
  FOREIGN KEY (last_message_id) REFERENCES public.chat_messages(id) ON DELETE SET NULL;

CREATE TABLE public.chat_reactions (
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);
CREATE INDEX chat_reactions_conversation ON public.chat_reactions (conversation_id);

-- 3. Regras de acesso ---------------------------------------------------------------

/** Membro da conversa e colaborador ativo (quem sai da empresa perde o acesso). */
CREATE OR REPLACE FUNCTION public.chat_is_member(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_members m
    WHERE m.conversation_id = _conversation_id AND m.user_id = auth.uid()
  ) AND EXISTS (
    SELECT 1 FROM employees e WHERE e.user_id = auth.uid() AND e.is_active
  );
$$;

/** Pode escrever: membro; nos canais de anúncios, só donos e administradores do canal. */
CREATE OR REPLACE FUNCTION public.chat_can_post(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.chat_is_member(_conversation_id) AND EXISTS (
    SELECT 1 FROM chat_members m JOIN chat_conversations c ON c.id = m.conversation_id
    WHERE m.conversation_id = _conversation_id AND m.user_id = auth.uid()
      AND (c.kind <> 'announcement' OR m.role IN ('owner', 'admin'))
  );
$$;

/** Conversa a que pertence um ficheiro do bucket chat-files ("<conversa>/<ficheiro>"). */
CREATE OR REPLACE FUNCTION public.chat_path_conversation(_name text)
RETURNS uuid
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN split_part(_name, '/', 1)::uuid
  END;
$$;

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;

-- Conversas e membros só se criam pelas funções abaixo (validam a empresa).
CREATE POLICY "Membros veem a conversa" ON public.chat_conversations
  FOR SELECT TO authenticated USING (public.chat_is_member(id));

CREATE POLICY "Membros veem os membros" ON public.chat_members
  FOR SELECT TO authenticated USING (public.chat_is_member(conversation_id));
CREATE POLICY "Cada um gere a sua participação" ON public.chat_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE UPDATE ON public.chat_members FROM authenticated;
GRANT UPDATE (is_pinned, is_muted, is_archived) ON public.chat_members TO authenticated;

CREATE POLICY "Membros leem as mensagens" ON public.chat_messages
  FOR SELECT TO authenticated USING (public.chat_is_member(conversation_id));
CREATE POLICY "Membros enviam mensagens" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.chat_can_post(conversation_id)
    AND (attachment_path IS NULL
         OR public.chat_path_conversation(attachment_path) = conversation_id)
  );
CREATE POLICY "O autor edita ou elimina" ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() AND public.chat_is_member(conversation_id))
  WITH CHECK (sender_id = auth.uid());
REVOKE UPDATE ON public.chat_messages FROM authenticated;
GRANT UPDATE (body, deleted_at) ON public.chat_messages TO authenticated;

CREATE POLICY "Membros veem as reações" ON public.chat_reactions
  FOR SELECT TO authenticated USING (public.chat_is_member(conversation_id));
CREATE POLICY "Membros reagem" ON public.chat_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.chat_is_member(conversation_id)
    AND EXISTS (SELECT 1 FROM public.chat_messages m
                WHERE m.id = message_id AND m.conversation_id = chat_reactions.conversation_id
                  AND m.deleted_at IS NULL)
  );
CREATE POLICY "Cada um retira as suas reações" ON public.chat_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4. Integridade das mensagens -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.chat_messages_before_write()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.edited_at := NULL;
    NEW.deleted_at := NULL;
    IF NEW.reply_to_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM chat_messages r
      WHERE r.id = NEW.reply_to_id AND r.conversation_id = NEW.conversation_id
    ) THEN
      RAISE EXCEPTION 'A mensagem citada não pertence a esta conversa';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE (o colaborador só pode mexer em body e deleted_at — ver GRANT acima)
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'A mensagem já foi eliminada';
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    -- Eliminar apaga o conteúdo (o ficheiro deixa de estar acessível pela mensagem).
    NEW.deleted_at := now();
    NEW.body := NULL;
    NEW.attachment_path := NULL;
    NEW.attachment_name := NULL;
    NEW.attachment_size := NULL;
    NEW.attachment_mime := NULL;
    NEW.duration_sec := NULL;
  ELSIF NEW.body IS DISTINCT FROM OLD.body THEN
    IF OLD.kind <> 'text' THEN
      RAISE EXCEPTION 'Só as mensagens de texto podem ser editadas';
    END IF;
    NEW.edited_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER chat_messages_before_write
  BEFORE INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_messages_before_write();

/** Nova mensagem: atualiza a conversa e marca-a como lida para quem a enviou. */
CREATE OR REPLACE FUNCTION public.chat_messages_after_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE chat_conversations
     SET last_message_at = NEW.created_at, last_message_id = NEW.id
   WHERE id = NEW.conversation_id;
  UPDATE chat_members
     SET last_read_at = NEW.created_at, is_archived = false
   WHERE conversation_id = NEW.conversation_id AND user_id = NEW.sender_id;
  -- Uma conversa arquivada volta a aparecer quando chega uma mensagem nova.
  UPDATE chat_members
     SET is_archived = false
   WHERE conversation_id = NEW.conversation_id AND is_archived;
  RETURN NEW;
END;
$$;

CREATE TRIGGER chat_messages_after_insert
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_messages_after_insert();

-- 5. Funções do Messenger -------------------------------------------------------------

/** Garante o canal "Geral" da empresa do utilizador e que ele é membro. */
CREATE OR REPLACE FUNCTION public.chat_bootstrap()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_conversation uuid;
BEGIN
  SELECT company_id INTO v_company FROM employees
   WHERE user_id = auth.uid() AND is_active LIMIT 1;
  IF v_company IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO chat_conversations (company_id, kind, title, description, is_default)
  VALUES (v_company, 'channel', 'Geral', 'Canal de toda a empresa', true)
  ON CONFLICT (company_id) WHERE is_default DO NOTHING;

  SELECT id INTO v_conversation FROM chat_conversations
   WHERE company_id = v_company AND is_default;

  INSERT INTO chat_members (conversation_id, user_id, last_read_at)
  VALUES (v_conversation, auth.uid(), now())
  ON CONFLICT DO NOTHING;
END;
$$;

/** Abre (ou cria) a conversa privada com um colega da mesma empresa. */
CREATE OR REPLACE FUNCTION public.chat_start_direct(_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_company uuid;
  v_key text;
  v_conversation uuid;
BEGIN
  SELECT company_id INTO v_company FROM employees WHERE user_id = v_me AND is_active LIMIT 1;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Conta sem colaborador ativo';
  END IF;
  IF _other_user_id IS NULL OR _other_user_id = v_me OR NOT public.chat_is_colleague(_other_user_id) THEN
    RAISE EXCEPTION 'Colega inválido';
  END IF;

  v_key := least(v_me::text, _other_user_id::text) || ':' || greatest(v_me::text, _other_user_id::text);

  INSERT INTO chat_conversations (company_id, kind, direct_key, created_by)
  VALUES (v_company, 'direct', v_key, v_me)
  ON CONFLICT (direct_key) DO NOTHING;

  SELECT id INTO v_conversation FROM chat_conversations WHERE direct_key = v_key;

  INSERT INTO chat_members (conversation_id, user_id, role)
  VALUES (v_conversation, v_me, 'member'), (v_conversation, _other_user_id, 'member')
  ON CONFLICT DO NOTHING;

  RETURN v_conversation;
END;
$$;

/** Cria um grupo com colegas da mesma empresa (quem cria fica como dono). */
CREATE OR REPLACE FUNCTION public.chat_create_group(_title text, _member_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_company uuid;
  v_conversation uuid;
  v_member uuid;
BEGIN
  SELECT company_id INTO v_company FROM employees WHERE user_id = v_me AND is_active LIMIT 1;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Conta sem colaborador ativo';
  END IF;
  IF _title IS NULL OR char_length(btrim(_title)) = 0 THEN
    RAISE EXCEPTION 'O grupo precisa de um nome';
  END IF;
  IF coalesce(array_length(_member_ids, 1), 0) = 0 OR array_length(_member_ids, 1) > 200 THEN
    RAISE EXCEPTION 'Escolha entre 1 e 200 colegas';
  END IF;

  INSERT INTO chat_conversations (company_id, kind, title, created_by)
  VALUES (v_company, 'group', btrim(_title), v_me)
  RETURNING id INTO v_conversation;

  INSERT INTO chat_members (conversation_id, user_id, role) VALUES (v_conversation, v_me, 'owner');

  FOREACH v_member IN ARRAY _member_ids LOOP
    IF v_member <> v_me THEN
      IF NOT public.chat_is_colleague(v_member) THEN
        RAISE EXCEPTION 'Só pode adicionar colegas da sua empresa';
      END IF;
      INSERT INTO chat_members (conversation_id, user_id) VALUES (v_conversation, v_member)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_conversation;
END;
$$;

/** Marca a conversa como lida (hora do servidor). */
CREATE OR REPLACE FUNCTION public.chat_mark_read(_conversation_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE chat_members SET last_read_at = now()
   WHERE conversation_id = _conversation_id AND user_id = auth.uid();
$$;

/** Lista de conversas do utilizador: última mensagem, não lidas e o colega (privadas). */
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
         m.role, m.is_pinned, m.is_muted, m.is_archived,
         (SELECT count(*)::int FROM chat_members x WHERE x.conversation_id = c.id),
         (SELECT count(*)::int FROM chat_messages u
           WHERE u.conversation_id = c.id AND u.created_at > m.last_read_at
             AND u.sender_id IS DISTINCT FROM auth.uid() AND u.deleted_at IS NULL),
         peer.user_id, peer.name, peer.position, peer.department,
         lm.sender_id, sender.name, lm.kind, left(lm.body, 160), lm.attachment_name,
         lm.deleted_at IS NOT NULL
  FROM chat_members m
  JOIN chat_conversations c ON c.id = m.conversation_id
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

REVOKE ALL ON FUNCTION public.chat_directory() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_is_colleague(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_bootstrap() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_start_direct(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_create_group(text, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_mark_read(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_list_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_directory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_is_colleague(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_bootstrap() TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_start_direct(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_create_group(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_mark_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_list_conversations() TO authenticated;

-- 6. Ficheiros privados ----------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-files', 'chat-files', false, 26214400,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
    'application/pdf', 'text/plain', 'text/csv', 'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Chat: membros leem os ficheiros" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-files' AND public.chat_is_member(public.chat_path_conversation(name)));

CREATE POLICY "Chat: membros enviam ficheiros" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-files' AND public.chat_can_post(public.chat_path_conversation(name)));

-- 7. Tempo real ------------------------------------------------------------------------
-- As mensagens e as participações chegam aos membros pelo Realtime (com as regras acima).
-- As reações não entram: um DELETE não passa pelas regras de acesso; a app avisa os
-- outros membros por broadcast e eles recarregam as reações da mensagem.
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages, public.chat_members;
