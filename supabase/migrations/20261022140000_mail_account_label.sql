-- Webmail: nome que cada pessoa dá a cada caixa na sua barra lateral ("Financeiro", "Beatriz –
-- faturas"…). É só dela e vale também nas caixas partilhadas (o endereço não muda). Vive na
-- tabela da ordem das caixas, que já é por pessoa e por caixa.

ALTER TABLE public.mail_account_order
  ADD COLUMN IF NOT EXISTS label text
  CHECK (label IS NULL OR char_length(btrim(label)) BETWEEN 1 AND 60);

COMMENT ON COLUMN public.mail_account_order.label IS
  'Nome da caixa escolhido por esta pessoa (null = mostra o endereço).';
