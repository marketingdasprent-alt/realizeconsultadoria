-- Cópia local dos emails das caixas IMAP (ver supabase/functions/mail-api/messageCache.ts):
-- cesto privado, só a função mail-api (service role) lê e escreve; sem políticas para os
-- utilizadores (o acesso passa sempre pela função, que confirma o acesso à caixa).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('mail-cache', 'mail-cache', false, 2097152, ARRAY['application/json'])
ON CONFLICT (id) DO NOTHING;
