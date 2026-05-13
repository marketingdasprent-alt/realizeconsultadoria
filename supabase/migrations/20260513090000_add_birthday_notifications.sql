-- Add birth_date column to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Create notification_emails_birthdays table
CREATE TABLE public.notification_emails_birthdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(email)
);

-- Enable RLS
ALTER TABLE public.notification_emails_birthdays ENABLE ROW LEVEL SECURITY;

-- RLS policy (same pattern as notification_emails_absences)
CREATE POLICY "Admins can manage birthday notification emails"
  ON public.notification_emails_birthdays
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Schedule cron job: send birthday reminders daily at 08:00 UTC
SELECT cron.schedule(
  'send-birthday-reminders',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jvvnsoasylusbmxfotci.supabase.co/functions/v1/send-birthday-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
