-- Create table for admin notification preferences
CREATE TABLE public.admin_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  notify_absences BOOLEAN NOT NULL DEFAULT false,
  notify_support_tickets BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.admin_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Only admins can manage notification preferences
CREATE POLICY "Admins can manage notification preferences"
  ON public.admin_notification_preferences
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_admin_notification_preferences_updated_at
  BEFORE UPDATE ON public.admin_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();