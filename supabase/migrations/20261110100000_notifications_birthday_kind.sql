-- Avisos de aniversário (rz_birthdays_daily, comentários nas publicações de aniversário)
ALTER TABLE public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_kind_check;
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_kind_check CHECK (kind = ANY (ARRAY[
  'appreciation', 'feed_comment', 'absence', 'ticket', 'document', 'task', 'event', 'assistant',
  'mail', 'mention', 'birthday'
]));
