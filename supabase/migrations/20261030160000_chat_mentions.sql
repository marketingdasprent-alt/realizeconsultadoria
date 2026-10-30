-- Messenger: marcar pessoas numa conversa (@Nome). A mensagem guarda quem foi marcado e cada
-- pessoa marcada (membro da conversa, não quem escreve) recebe uma notificação — também se
-- tiver silenciado a conversa, como no WhatsApp.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_kind_check;
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_kind_check
  CHECK (kind = ANY (ARRAY['appreciation', 'feed_comment', 'absence', 'ticket', 'document',
    'task', 'event', 'assistant', 'mail', 'mention']));

CREATE OR REPLACE FUNCTION public.chat_notify_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_title text;
  v_where text;
BEGIN
  IF coalesce(array_length(NEW.mentions, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;
  SELECT CASE WHEN c.kind = 'direct' THEN NULL ELSE c.title END INTO v_where
  FROM chat_conversations c WHERE c.id = NEW.conversation_id;
  v_title := rz_first_name(NEW.sender_id) || ' mencionou-o'
    || CASE WHEN v_where IS NOT NULL THEN ' em ' || v_where ELSE '' END;

  FOREACH v_user IN ARRAY (SELECT array_agg(DISTINCT u) FROM unnest(NEW.mentions[1:30]) u) LOOP
    IF v_user IS DISTINCT FROM NEW.sender_id AND EXISTS (
      SELECT 1 FROM chat_members m WHERE m.conversation_id = NEW.conversation_id AND m.user_id = v_user
    ) THEN
      PERFORM rz_notify(v_user, 'mention', v_title, coalesce(NEW.body, ''),
        '/colaborador/mensagens?c=' || NEW.conversation_id, NEW.sender_id);
    END IF;
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'menções do chat falharam: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_mentions ON public.chat_messages;
CREATE TRIGGER chat_messages_mentions
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_notify_mentions();
