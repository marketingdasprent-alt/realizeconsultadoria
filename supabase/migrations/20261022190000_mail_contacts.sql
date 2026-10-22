-- Realize 2.0 · Webmail: contactos de quem a pessoa já escreveu (sugestões ao digitar) e listas
-- de contactos próprias (escreve-se o nome da lista e vão todos). Tudo é só de cada pessoa.

CREATE TABLE public.mail_contacts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254 AND email = lower(email)),
  name text CHECK (name IS NULL OR char_length(name) <= 120),
  uses int NOT NULL DEFAULT 1 CHECK (uses >= 1),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, email)
);
CREATE INDEX mail_contacts_recent ON public.mail_contacts (user_id, last_used_at DESC);

CREATE TABLE public.mail_contact_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  -- [{ "email": "...", "name": "..." | null }]
  members jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(members) = 'array' AND jsonb_array_length(members) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.mail_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_contact_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mail: os meus contactos" ON public.mail_contacts
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Mail: as minhas listas de contactos" ON public.mail_contact_lists
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.mail_contacts, public.mail_contact_lists FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_contacts, public.mail_contact_lists
  TO authenticated;
GRANT ALL ON public.mail_contacts, public.mail_contact_lists TO service_role;

-- Regista quem recebeu um email (ou os do histórico): sobe o uso e guarda o nome se o houver.
-- _items: [{ "email": "...", "name": "..." | null, "uses": 1 }]
CREATE OR REPLACE FUNCTION public.mail_remember_contacts(_items jsonb)
RETURNS void
LANGUAGE sql SET search_path = public
AS $$
  INSERT INTO mail_contacts (user_id, email, name, uses, last_used_at)
  SELECT auth.uid(), lower(btrim(i->>'email')), nullif(btrim(i->>'name'), ''),
         greatest(1, coalesce((i->>'uses')::int, 1)), now()
  FROM jsonb_array_elements(_items) i
  WHERE auth.uid() IS NOT NULL
    AND btrim(i->>'email') ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    AND char_length(btrim(i->>'email')) <= 254
  ON CONFLICT (user_id, email) DO UPDATE
    SET uses = mail_contacts.uses + excluded.uses,
        last_used_at = now(),
        name = coalesce(excluded.name, mail_contacts.name);
$$;
REVOKE ALL ON FUNCTION public.mail_remember_contacts(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mail_remember_contacts(jsonb) TO authenticated;
