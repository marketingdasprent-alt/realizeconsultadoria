-- Realize 2.0 · Email novo mais depressa: a verificação passa de 2 minutos para 30 segundos.
-- polled_at reserva cada caixa por passagem (sem avisos repetidos) e deixa as IMAP a cada
-- 2 minutos (os servidores IMAP limitam os logins).
ALTER TABLE public.mail_accounts ADD COLUMN IF NOT EXISTS polled_at timestamptz;

SELECT cron.schedule('rz-mail-poll', '30 seconds', 'SELECT public.rz_mail_poll()');
