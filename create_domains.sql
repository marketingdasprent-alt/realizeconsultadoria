-- Drop the table and policies if they already exist to avoid conflicts when recreating
DROP TABLE IF EXISTS public.site_domains CASCADE;

CREATE TABLE IF NOT EXISTS public.site_domains (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    domain_name text NOT NULL,
    renewal_value numeric(10, 2) NOT NULL DEFAULT 0,
    creation_date date NOT NULL,
    last_paid_year integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.site_domains ENABLE ROW LEVEL SECURITY;

-- Policies (Admins only)
CREATE POLICY "Admins can manage site_domains" 
ON public.site_domains 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Note: To enable the cron job, ensure you have pg_cron and pg_net enabled.
-- Run the following to schedule the daily check at 08:00 AM.
-- SELECT cron.schedule(
--   'domain-renewal-reminder',
--   '0 8 * * *',
--   $$
--     select net.http_post(
--         url:='https://jvvnsoasylusbmyfotci.supabase.co/functions/v1/send-domain-renewal-reminders',
--         headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
--         body:='{}'::jsonb
--     )
--   $$
-- );
