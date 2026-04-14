-- Add status column to absence_periods to track approved/rejected days
ALTER TABLE public.absence_periods 
ADD COLUMN status text NOT NULL DEFAULT 'pending';

-- Add check constraint for valid statuses
ALTER TABLE public.absence_periods
ADD CONSTRAINT absence_periods_status_check 
CHECK (status IN ('pending', 'approved', 'rejected'));