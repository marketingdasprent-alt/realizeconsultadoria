-- Comunicados: quem enviou (o "Nome do remetente" do formulário, ex.: "Thiago Sousa ·
-- Desenvolvimento"), para o Feed não dizer sempre "Comunicado dos RH".
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS sender_name text
  CHECK (sender_name IS NULL OR char_length(sender_name) <= 120);
