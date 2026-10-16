-- Realize 2.0 · Caixas Microsoft 365 partilhadas pelo admin sem palavra-passe: a app
-- "Realize Webmail" do Entra tem permissões de aplicação (Mail.ReadWrite, Mail.Send) e a
-- função mail-api lê/envia com um token da própria app (client credentials). O Exchange
-- Online já não aceita IMAP com palavra-passe, por isso estas caixas não usam o Vault.

ALTER TABLE public.mail_accounts DROP CONSTRAINT IF EXISTS mail_accounts_auth_method_check;
ALTER TABLE public.mail_accounts ADD CONSTRAINT mail_accounts_auth_method_check
  CHECK (auth_method = ANY (ARRAY['oauth-google', 'oauth-microsoft', 'imap', 'app-microsoft']));
