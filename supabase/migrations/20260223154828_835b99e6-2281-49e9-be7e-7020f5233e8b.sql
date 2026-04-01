
-- Drop existing constraint
ALTER TABLE public.absences DROP CONSTRAINT IF EXISTS absences_absence_type_check;

-- Add updated constraint with 'training'
ALTER TABLE public.absences ADD CONSTRAINT absences_absence_type_check
  CHECK (absence_type = ANY (ARRAY[
    'vacation', 'sick_leave', 'appointment', 'personal_leave',
    'maternity', 'paternity', 'other', 'training'
  ]));

-- Add training_mode column
ALTER TABLE public.absences ADD COLUMN IF NOT EXISTS training_mode text;

-- Add constraint for training_mode values
ALTER TABLE public.absences ADD CONSTRAINT absences_training_mode_check
  CHECK (training_mode IS NULL OR training_mode IN ('online', 'in_person'));
