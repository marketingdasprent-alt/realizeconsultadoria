-- Realize 2.0 · Assinaturas de email em HTML (com imagens e links). As imagens ficam num
-- bucket público (os programas de email não mostram imagens embutidas em base64), na pasta
-- de cada pessoa: "<user_id>/<ficheiro>". O HTML é limpo no browser antes de gravar.

ALTER TABLE public.mail_accounts DROP CONSTRAINT IF EXISTS mail_accounts_signature_check;
ALTER TABLE public.mail_accounts ADD CONSTRAINT mail_accounts_signature_check
  CHECK (signature IS NULL OR char_length(signature) <= 20000);

ALTER TABLE public.mail_account_members DROP CONSTRAINT IF EXISTS mail_account_members_signature_check;
ALTER TABLE public.mail_account_members ADD CONSTRAINT mail_account_members_signature_check
  CHECK (signature IS NULL OR char_length(signature) <= 20000);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('mail-signatures', 'mail-signatures', true, 1048576,
        ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = true, file_size_limit = 1048576,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

CREATE POLICY "Assinaturas: enviar imagens na própria pasta" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mail-signatures' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Assinaturas: apagar as próprias imagens" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'mail-signatures' AND (storage.foldername(name))[1] = auth.uid()::text);
