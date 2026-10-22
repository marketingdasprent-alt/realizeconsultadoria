-- Webmail: imagens das assinaturas até 5 MB (eram 1 MB). A app reduz as grandes antes de enviar.
UPDATE storage.buckets SET file_size_limit = 5242880 WHERE id = 'mail-signatures';
