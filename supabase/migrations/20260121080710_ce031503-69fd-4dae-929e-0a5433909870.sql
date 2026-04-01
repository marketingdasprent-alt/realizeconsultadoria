-- Add columns for partial day absences
ALTER TABLE public.absence_periods 
ADD COLUMN period_type text NOT NULL DEFAULT 'full_day',
ADD COLUMN start_time time,
ADD COLUMN end_time time;

-- Add comments for documentation
COMMENT ON COLUMN public.absence_periods.period_type IS 'Type of period: full_day or partial';
COMMENT ON COLUMN public.absence_periods.start_time IS 'Start time (only when period_type = partial)';
COMMENT ON COLUMN public.absence_periods.end_time IS 'End time (only when period_type = partial)';

-- Add check constraint for valid period_type values
ALTER TABLE public.absence_periods 
ADD CONSTRAINT absence_periods_period_type_check 
CHECK (period_type IN ('full_day', 'partial'));

-- Add check constraint to ensure times are set when partial
ALTER TABLE public.absence_periods 
ADD CONSTRAINT absence_periods_partial_times_check 
CHECK (
  (period_type = 'full_day' AND start_time IS NULL AND end_time IS NULL) OR
  (period_type = 'partial' AND start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
);