-- Create table for absence notification emails
CREATE TABLE public.notification_emails_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(email)
);

-- Create table for support notification emails (per department)
CREATE TABLE public.notification_emails_support (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES support_departments(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(department_id, email)
);

-- Enable RLS
ALTER TABLE public.notification_emails_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_emails_support ENABLE ROW LEVEL SECURITY;

-- RLS policies for absence emails
CREATE POLICY "Admins can manage absence notification emails"
  ON public.notification_emails_absences
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for support emails
CREATE POLICY "Admins can manage support notification emails"
  ON public.notification_emails_support
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Migrate existing notification email from system_settings if exists
INSERT INTO public.notification_emails_absences (email, is_active)
SELECT value, true FROM public.system_settings WHERE key = 'notification_email' AND value IS NOT NULL AND value != ''
ON CONFLICT (email) DO NOTHING;

-- Also add to RH department for support
INSERT INTO public.notification_emails_support (department_id, email, is_active)
SELECT sd.id, ss.value, true 
FROM public.system_settings ss, public.support_departments sd 
WHERE ss.key = 'notification_email' 
  AND ss.value IS NOT NULL 
  AND ss.value != ''
  AND sd.name ILIKE '%recursos humanos%'
ON CONFLICT (department_id, email) DO NOTHING;