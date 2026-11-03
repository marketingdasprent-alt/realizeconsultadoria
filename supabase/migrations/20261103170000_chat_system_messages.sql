-- Realize 2.0 · Mensagens de sistema nos grupos: "Ana entrou no grupo", "Rui saiu do grupo",
-- "Luiz retirou a Marta do grupo". São mensagens normais (kind = 'system'), criadas pelas funções
-- chat_add_members e chat_remove_member; não têm push, não contam como por ler, não se editam
-- nem se eliminam.

-- 1. Novo tipo de mensagem ------------------------------------------------------------------
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_kind_check;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_kind_check
  CHECK (kind = ANY (ARRAY['text', 'image', 'file', 'audio', 'system']));

ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_check;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_check CHECK (
  deleted_at IS NOT NULL
  OR (kind IN ('text', 'system') AND body IS NOT NULL AND char_length(btrim(body)) > 0)
  OR (kind NOT IN ('text', 'system') AND attachment_path IS NOT NULL)
);

-- 2. Nome curto (primeiro e último) para as mensagens --------------------------------------
CREATE OR REPLACE FUNCTION public.chat_short_name(p_user uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT CASE
        WHEN array_length(string_to_array(btrim(e.name), ' '), 1) > 1
          THEN split_part(btrim(e.name), ' ', 1) || ' '
               || (string_to_array(btrim(e.name), ' '))[array_length(string_to_array(btrim(e.name), ' '), 1)]
        ELSE btrim(e.name)
      END
     FROM employees e WHERE e.user_id = p_user LIMIT 1),
    'Alguém'
  );
$$;
REVOKE ALL ON FUNCTION public.chat_short_name(uuid) FROM PUBLIC, anon, authenticated;

-- 3. Triggers: sem push, sem desarquivar e sem edição das mensagens de sistema -------------
CREATE OR REPLACE FUNCTION public.chat_messages_after_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE chat_conversations
     SET last_message_at = NEW.created_at, last_message_id = NEW.id
   WHERE id = NEW.conversation_id;
  UPDATE chat_members
     SET last_read_at = NEW.created_at
   WHERE conversation_id = NEW.conversation_id AND user_id = NEW.sender_id;
  -- Uma entrada ou saída não tira a conversa do arquivo
  IF NEW.kind <> 'system' THEN
    UPDATE chat_member_settings
       SET is_archived = false, updated_at = now()
     WHERE conversation_id = NEW.conversation_id AND is_archived
       AND (user_id = NEW.sender_id OR NOT is_muted);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_push_on_chat_message()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'vault', 'net'
AS $function$
DECLARE
  v_token text;
BEGIN
  -- Entradas e saídas de um grupo não geram notificação
  IF NEW.kind = 'system' THEN
    RETURN NEW;
  END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.chat_messages_before_write()
RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
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
  IF OLD.kind = 'system' THEN
    RAISE EXCEPTION 'As mensagens do grupo não se alteram';
  END IF;
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
$function$;

-- 4. Entrar no grupo ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chat_add_members(_conversation_id uuid, _user_ids uuid[])
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_member uuid;
  v_added integer := 0;
  v_names text[] := '{}';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM chat_conversations c
    JOIN chat_members m ON m.conversation_id = c.id AND m.user_id = v_me
    WHERE c.id = _conversation_id AND c.kind = 'group' AND NOT c.is_default
  ) THEN
    RAISE EXCEPTION 'Só os membros podem adicionar pessoas a este grupo';
  END IF;
  IF coalesce(array_length(_user_ids, 1), 0) = 0 OR array_length(_user_ids, 1) > 200 THEN
    RAISE EXCEPTION 'Escolha entre 1 e 200 colegas';
  END IF;

  FOREACH v_member IN ARRAY _user_ids LOOP
    IF v_member <> v_me THEN
      IF NOT public.chat_is_colleague(v_member) THEN
        RAISE EXCEPTION 'Só pode adicionar colegas da sua empresa';
      END IF;
      INSERT INTO chat_members (conversation_id, user_id) VALUES (_conversation_id, v_member)
      ON CONFLICT DO NOTHING;
      IF FOUND THEN
        v_added := v_added + 1;
        v_names := v_names || chat_short_name(v_member);
      END IF;
    END IF;
  END LOOP;

  -- "Ana entrou no grupo" / "Ana e Rui entraram no grupo" / "7 pessoas entraram no grupo"
  IF v_added > 0 THEN
    INSERT INTO chat_messages (conversation_id, sender_id, kind, body)
    VALUES (
      _conversation_id, v_me, 'system',
      CASE
        WHEN v_added = 1 THEN v_names[1] || ' entrou no grupo'
        WHEN v_added <= 4 THEN
          array_to_string(v_names[1:v_added - 1], ', ') || ' e ' || v_names[v_added] || ' entraram no grupo'
        ELSE v_added || ' pessoas entraram no grupo'
      END
    );
  END IF;
  RETURN v_added;
END;
$function$;

-- 5. Sair do grupo / ser retirado ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chat_remove_member(_conversation_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_my_role text;
  v_their_role text;
BEGIN
  SELECT m.role INTO v_my_role
  FROM chat_conversations c
  JOIN chat_members m ON m.conversation_id = c.id AND m.user_id = v_me
  WHERE c.id = _conversation_id AND c.kind = 'group' AND NOT c.is_default;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Só os membros podem mexer neste grupo';
  END IF;

  SELECT role INTO v_their_role FROM chat_members
  WHERE conversation_id = _conversation_id AND user_id = _user_id;
  IF NOT FOUND THEN
    RETURN; -- já não está no grupo
  END IF;

  IF _user_id <> v_me AND v_my_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Só quem criou o grupo pode tirar pessoas';
  END IF;

  DELETE FROM chat_members WHERE conversation_id = _conversation_id AND user_id = _user_id;

  -- O dono saiu: o membro mais antigo fica a gerir o grupo.
  IF v_their_role = 'owner' THEN
    UPDATE chat_members SET role = 'owner'
    WHERE conversation_id = _conversation_id
      AND user_id = (
        SELECT user_id FROM chat_members
        WHERE conversation_id = _conversation_id
        ORDER BY joined_at, user_id
        LIMIT 1
      );
  END IF;

  INSERT INTO chat_messages (conversation_id, sender_id, kind, body)
  VALUES (
    _conversation_id, v_me, 'system',
    CASE WHEN _user_id = v_me THEN chat_short_name(v_me) || ' saiu do grupo'
         ELSE chat_short_name(v_me) || ' retirou ' || chat_short_name(_user_id) || ' do grupo' END
  );
END;
$function$;

-- 6. Por ler: as mensagens de sistema não contam --------------------------------------------
CREATE OR REPLACE FUNCTION public.chat_list_conversations()
RETURNS TABLE(id uuid, kind text, title text, is_default boolean, created_at timestamp with time zone, last_message_at timestamp with time zone, my_role text, is_pinned boolean, is_muted boolean, is_archived boolean, member_count integer, unread integer, peer_user_id uuid, peer_name text, peer_position text, peer_department text, last_sender_id uuid, last_sender_name text, last_kind text, last_body text, last_attachment_name text, last_deleted boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, c.kind, c.title, c.is_default, c.created_at, c.last_message_at,
         m.role, coalesce(s.is_pinned, false), coalesce(s.is_muted, false),
         coalesce(s.is_archived, false),
         (SELECT count(*)::int FROM chat_members x WHERE x.conversation_id = c.id),
         (SELECT count(*)::int FROM chat_messages u
           WHERE u.conversation_id = c.id AND u.created_at > m.last_read_at
             AND u.sender_id IS DISTINCT FROM auth.uid() AND u.deleted_at IS NULL
             AND u.kind <> 'system'),
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
$function$;
