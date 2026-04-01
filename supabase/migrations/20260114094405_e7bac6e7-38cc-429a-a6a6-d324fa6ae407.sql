-- Create session_transfers table for PWA session transfer
CREATE TABLE public.session_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster token lookups
CREATE INDEX idx_session_transfers_token ON public.session_transfers(token);
CREATE INDEX idx_session_transfers_expires ON public.session_transfers(expires_at);

-- Enable RLS
ALTER TABLE public.session_transfers ENABLE ROW LEVEL SECURITY;

-- Users can create tokens for themselves (via edge function with service role)
-- No direct access - all operations through edge functions
CREATE POLICY "Service role only" ON public.session_transfers
  FOR ALL USING (false);

-- Auto-cleanup old tokens (runs via pg_cron or manual cleanup)
CREATE OR REPLACE FUNCTION public.cleanup_expired_session_transfers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.session_transfers 
  WHERE expires_at < now() OR used_at IS NOT NULL;
END;
$$;