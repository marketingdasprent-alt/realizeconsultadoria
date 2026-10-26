-- Messenger: foto dos grupos. Fica no bucket público "avatars" em groups/<conversa>/…; qualquer
-- membro do grupo pode mudar (como o nome). A coluna guarda o caminho, não o URL.
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS avatar_path text;

CREATE OR REPLACE FUNCTION public.chat_set_group_avatar(_conversation_id uuid, _path text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM chat_conversations c
    JOIN chat_members m ON m.conversation_id = c.id AND m.user_id = auth.uid()
    WHERE c.id = _conversation_id AND c.kind = 'group'
  ) THEN
    RAISE EXCEPTION 'Só os membros podem mudar a foto deste grupo';
  END IF;
  IF _path IS NOT NULL AND _path NOT LIKE 'groups/' || _conversation_id::text || '/%' THEN
    RAISE EXCEPTION 'Foto inválida';
  END IF;
  UPDATE chat_conversations SET avatar_path = _path WHERE id = _conversation_id;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_set_group_avatar(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.chat_set_group_avatar(uuid, text) TO authenticated;

-- Enviar a foto: só membros do grupo, só na pasta desse grupo.
DROP POLICY IF EXISTS "Avatares: foto do grupo" ON storage.objects;
CREATE POLICY "Avatares: foto do grupo" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND CASE
      WHEN (storage.foldername(name))[1] = 'groups'
        AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.chat_is_member(((storage.foldername(name))[2])::uuid)
      ELSE false
    END
  );
