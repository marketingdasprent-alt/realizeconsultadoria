-- Realize 2.0 · Webmail: ligar/desligar os avisos de email novo por caixa.
-- Nas caixas próprias fica na conta; nas partilhadas, na linha de cada membro (cada pessoa
-- decide por si). Por defeito avisa.
ALTER TABLE public.mail_accounts ADD COLUMN IF NOT EXISTS notify boolean NOT NULL DEFAULT true;
ALTER TABLE public.mail_account_members ADD COLUMN IF NOT EXISTS notify boolean NOT NULL DEFAULT true;

GRANT UPDATE (notify) ON public.mail_accounts TO authenticated;
GRANT UPDATE (notify) ON public.mail_account_members TO authenticated;
