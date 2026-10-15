-- Realize 2.0 · Fotografia de perfil. Cada pessoa muda só a sua; os colegas veem-na no
-- Messenger, Feed, Colaboradores, organograma, etc. (vem no chat_directory). As fotos ficam
-- num bucket público (são para mostrar a toda a empresa): "<user_id>/<data>.webp".

CREATE TABLE public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_path text CHECK (avatar_path IS NULL OR char_length(avatar_path) <= 300),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Perfis: ver" ON public.user_profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Perfis: criar o próprio" ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Perfis: editar o próprio" ON public.user_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
SET public = true, file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png'];

CREATE POLICY "Avatares: enviar o próprio" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatares: apagar o próprio" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatares: ver os próprios" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Diretório da empresa com a fotografia (mesmas colunas de antes + avatar_path).
DROP FUNCTION IF EXISTS public.chat_directory();
CREATE FUNCTION public.chat_directory()
RETURNS TABLE (
  user_id uuid,
  employee_id uuid,
  name text,
  "position" text,
  department text,
  email text,
  company_id uuid,
  company_name text,
  avatar_path text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.user_id, e.id, e.name, e.position, e.department, e.email, e.company_id, c.name,
         p.avatar_path
  FROM employees e
  JOIN companies c ON c.id = e.company_id
  LEFT JOIN user_profiles p ON p.user_id = e.user_id
  WHERE e.is_active
    AND e.user_id IS NOT NULL
    AND e.company_id = (SELECT me.company_id FROM employees me
                        WHERE me.user_id = auth.uid() AND me.is_active LIMIT 1)
  ORDER BY e.name;
$$;
REVOKE ALL ON FUNCTION public.chat_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_directory() TO authenticated;
