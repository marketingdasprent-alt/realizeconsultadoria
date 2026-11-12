-- App de email para clientes de fora (mail.realizeconsultadoria.pt): entra-se com a própria
-- caixa (IMAP com palavra-passe, ou Microsoft). Cada caixa corresponde a uma conta interna só
-- de email (app_metadata.mail_only → papel mail_client), nunca a uma conta da Realize.
-- Tabelas só para o servidor (função mail-login, com service role): RLS ligado e sem regras.

CREATE TABLE IF NOT EXISTS public.mail_app_users (
  mailbox text PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
ALTER TABLE public.mail_app_users ENABLE ROW LEVEL SECURITY;

-- Entrada pela Microsoft: o regresso do OAuth traz um código de uma só utilização (2 min) que a
-- app troca pela sessão (os tokens nunca vão no endereço)
CREATE TABLE IF NOT EXISTS public.mail_login_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mail_login_codes ENABLE ROW LEVEL SECURITY;

-- Tentativas falhadas (por caixa e por IP): trava quem tente adivinhar palavras-passe
CREATE TABLE IF NOT EXISTS public.mail_login_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mailbox text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mail_login_attempts_mailbox_idx ON public.mail_login_attempts (mailbox, created_at);
CREATE INDEX IF NOT EXISTS mail_login_attempts_ip_idx ON public.mail_login_attempts (ip, created_at);
ALTER TABLE public.mail_login_attempts ENABLE ROW LEVEL SECURITY;

-- Pedidos OAuth de entrada ainda não têm utilizador
ALTER TABLE public.mail_oauth_states ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.mail_oauth_states ADD COLUMN IF NOT EXISTS login boolean NOT NULL DEFAULT false;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'rz-mail-login-clean';
SELECT cron.schedule('rz-mail-login-clean', '*/30 * * * *', $$
  DELETE FROM public.mail_login_codes WHERE created_at < now() - interval '10 minutes';
  DELETE FROM public.mail_login_attempts WHERE created_at < now() - interval '1 day';
$$);
