-- Correção da 20261019160000: as colunas notify também têm de poder ser lidas (as tabelas de
-- email têm permissões por coluna; sem isto a lista de caixas falhava toda).
GRANT SELECT (notify) ON public.mail_accounts TO authenticated;
GRANT SELECT (notify) ON public.mail_account_members TO authenticated;
