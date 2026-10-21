-- Realize 2.0 · Departamentos e funções passam a ser listas geridas pelo admin (Configurações).
-- Na ficha do colaborador escolhem-se destas listas em vez de se escreverem à mão. A ficha
-- continua a guardar o nome em employees.department / employees.position (o Feed, as equipas
-- e o diretório usam esse texto), por isso mudar o nome de um item atualiza as fichas.

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX departments_name_key ON public.departments (public.rz_norm(name));

CREATE TABLE public.job_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX job_positions_name_key ON public.job_positions (public.rz_norm(name));

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Departamentos: ver" ON public.departments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Departamentos: admin gere" ON public.departments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Funções: ver" ON public.job_positions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Funções: admin gere" ON public.job_positions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Mudar o nome de um item muda-o também nas fichas que o tinham.
CREATE OR REPLACE FUNCTION public.rz_rename_department_in_employees()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE employees SET department = NEW.name
    WHERE public.rz_norm(department) = public.rz_norm(OLD.name);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER departments_rename AFTER UPDATE OF name ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.rz_rename_department_in_employees();

CREATE OR REPLACE FUNCTION public.rz_rename_position_in_employees()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE employees SET position = NEW.name
    WHERE public.rz_norm(position) = public.rz_norm(OLD.name);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER job_positions_rename AFTER UPDATE OF name ON public.job_positions
  FOR EACH ROW EXECUTE FUNCTION public.rz_rename_position_in_employees();

-- Listas iniciais: os departamentos e funções pedidos + os que já estavam nas fichas.
INSERT INTO public.departments (name) VALUES
  ('Direção'), ('Financeiro'), ('Comercial'), ('Marketing'), ('Contabilidade'),
  ('Oficina'), ('Frota'), ('TVDE'), ('TI'), ('Limpeza')
ON CONFLICT DO NOTHING;

INSERT INTO public.job_positions (name) VALUES
  ('CEO'), ('Diretor'), ('Diretor Financeiro'), ('Diretor Comercial'),
  ('Diretor de Desenvolvimento e Marketing'), ('Diretor de Contabilidade'),
  ('Diretor de Oficina'), ('Diretor de Frota'), ('Diretor TVDE'),
  ('Assist. Contabilidade'), ('Assist. TI'), ('Assist. Marketing'),
  ('Assistente Administrativo 1º'), ('Chefe de Marketing'), ('Chefe de Oficina'),
  ('Mecânico de Auto'), ('Mecânico'), ('Mecânico Automóveis Ligeiros'),
  ('Gestor TVDE'), ('Gestor de Frota'), ('Limpeza')
ON CONFLICT DO NOTHING;

-- Fichas antigas passam a usar o nome da lista (ex.: "oficina" → "Oficina").
UPDATE employees e SET department = d.name
FROM departments d
WHERE public.rz_norm(e.department) = public.rz_norm(d.name) AND e.department <> d.name;

UPDATE employees SET position = 'Chefe de Marketing' WHERE position = 'Chefe de Markenting';
UPDATE employees SET position = 'Assistente Administrativo 1º' WHERE position = 'Assistente administrativo 1º';
UPDATE employees e SET position = p.name
FROM job_positions p
WHERE public.rz_norm(e.position) = public.rz_norm(p.name) AND e.position <> p.name;
