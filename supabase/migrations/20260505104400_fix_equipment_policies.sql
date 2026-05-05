-- Corrigir políticas de RLS para equipamentos e categorias
-- Permitir que todos os administradores possam gerir estas tabelas, não apenas super-admins

-- 1. Equipamentos
DROP POLICY IF EXISTS "Super admins can manage equipments" ON public.equipments;

CREATE POLICY "Admins can manage equipments"
  ON public.equipments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Categorias de Equipamentos
DROP POLICY IF EXISTS "Super admins can manage equipment categories" ON public.equipment_categories;

CREATE POLICY "Admins can manage equipment categories"
  ON public.equipment_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
