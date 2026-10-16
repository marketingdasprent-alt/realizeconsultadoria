-- Realize 2.0 · Documentos da empresa: pastas do servidor de ficheiros (D:\Shares no SRVDC)
-- que cada colaborador pode abrir no editor ONLYOFFICE.
--
-- A edge function `company-files` fala com o agente de ficheiros do SRVDC e só deixa abrir
-- caminhos dentro de uma pasta atribuída aqui ao colaborador. O caminho é relativo a
-- D:\Shares, com "/" e sem barra no início nem no fim, e usa os nomes exatamente como o
-- agente os devolve (ex.: 'DASPRENT/Marketing'). Quando houver departamentos a sério, junta-se
-- uma coluna de departamento ao lado de employee_id.

CREATE TABLE IF NOT EXISTS public.folder_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  path text NOT NULL,
  -- Nome a mostrar (por omissão, o último nome do caminho)
  label text,
  permission text NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'edit')),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT folder_assignments_unique UNIQUE (employee_id, path),
  -- Mesmas regras do agente: sem barras nas pontas, sem "." nem "..", sem barra invertida
  CONSTRAINT folder_assignments_path CHECK (
    path <> ''
    AND path !~ '^/|/$|//'
    AND position(chr(92) IN path) = 0
    AND path !~ '(^|/)[.]{1,2}(/|$)'
  )
);

-- Só os admins mexem aqui; o colaborador nunca lê a tabela diretamente (a edge function lê as
-- pastas dele com a chave de serviço, depois de validar a sessão).
ALTER TABLE public.folder_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerem as pastas atribuídas" ON public.folder_assignments;
CREATE POLICY "Admins gerem as pastas atribuídas" ON public.folder_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
