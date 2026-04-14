-- Remover a constraint atual
ALTER TABLE public.absences 
DROP CONSTRAINT IF EXISTS absences_absence_type_check;

-- Criar nova constraint incluindo 'appointment'
ALTER TABLE public.absences 
ADD CONSTRAINT absences_absence_type_check 
CHECK (absence_type = ANY (ARRAY[
  'vacation'::text, 
  'sick_leave'::text, 
  'appointment'::text,
  'personal_leave'::text, 
  'maternity'::text, 
  'paternity'::text, 
  'other'::text
]));