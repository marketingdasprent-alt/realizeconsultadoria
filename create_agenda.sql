CREATE TABLE IF NOT EXISTS public.legal_agenda_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    event_date date NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.legal_agenda_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access to legal_agenda_events" ON public.legal_agenda_events;
CREATE POLICY "Enable all access to legal_agenda_events" ON public.legal_agenda_events FOR ALL USING (true);
