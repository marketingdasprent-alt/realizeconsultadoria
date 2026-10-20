-- Realize 2.0 · Miniaturas dos Documentos da empresa (1.ª página gerada pelo ONLYOFFICE).
-- Bucket privado: só a edge function company-files (service role) lê e grava; o browser
-- recebe links assinados. O nome de cada miniatura é um hash do caminho + data + tamanho, por
-- isso um ficheiro alterado gera outra.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-file-thumbs', 'company-file-thumbs', false, 2097152, ARRAY['image/png', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;
