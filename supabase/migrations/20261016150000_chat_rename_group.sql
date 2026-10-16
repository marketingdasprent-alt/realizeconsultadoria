-- Realize 2.0 · Messenger: mudar o nome de um grupo (qualquer membro, como no WhatsApp).
-- Canais e anúncios não: são geridos pelo admin.

CREATE OR REPLACE FUNCTION public.chat_rename_group(_conversation_id uuid, _title text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_title text := btrim(coalesce(_title, ''));
BEGIN
  IF char_length(v_title) = 0 OR char_length(v_title) > 80 THEN
    RAISE EXCEPTION 'O nome do grupo tem de ter entre 1 e 80 caracteres';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM chat_conversations c
    JOIN chat_members m ON m.conversation_id = c.id AND m.user_id = auth.uid()
    WHERE c.id = _conversation_id AND c.kind = 'group'
  ) THEN
    RAISE EXCEPTION 'Só os membros podem mudar o nome deste grupo';
  END IF;
  UPDATE chat_conversations SET title = v_title WHERE id = _conversation_id;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_rename_group(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_rename_group(uuid, text) TO authenticated;
