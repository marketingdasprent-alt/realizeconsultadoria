-- Diagnóstico das notificações push: o browser regista porque não conseguiu ativar (estado da
-- autorização, service worker, erro do subscribe), para se perceber sem ter o aparelho na mão.
CREATE TABLE IF NOT EXISTS public.push_issues (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  state text NOT NULL,
  detail text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Push: registar o meu problema" ON public.push_issues;
CREATE POLICY "Push: registar o meu problema" ON public.push_issues
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
GRANT INSERT ON public.push_issues TO authenticated;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'rz-push-issues-clean';
SELECT cron.schedule('rz-push-issues-clean', '23 4 * * *',
  $$DELETE FROM public.push_issues WHERE created_at < now() - interval '30 days'$$);
