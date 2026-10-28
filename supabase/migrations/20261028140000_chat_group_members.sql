-- Messenger: pôr e tirar pessoas de um grupo já criado.
--   Adicionar: qualquer membro (como mudar o nome), só colegas ativos da mesma empresa.
--   Tirar outra pessoa: só o dono do grupo (role 'owner', quem o criou).
--   Sair: qualquer membro; se o dono sair, o membro mais antigo passa a dono.
-- O grupo da empresa (is_default) não se mexe por aqui.

CREATE OR REPLACE FUNCTION public.chat_add_members(_conversation_id uuid, _user_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_member uuid;
  v_added integer := 0;
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
      IF FOUND THEN v_added := v_added + 1; END IF;
    END IF;
  END LOOP;
  RETURN v_added;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_remove_member(_conversation_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
END;
$$;

REVOKE ALL ON FUNCTION public.chat_add_members(uuid, uuid[]) FROM anon, public;
REVOKE ALL ON FUNCTION public.chat_remove_member(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.chat_add_members(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_remove_member(uuid, uuid) TO authenticated;
