-- Reações com emojis nos reconhecimentos (como nas publicações do Feed). Quem vê o
-- reconhecimento (regras de appreciations) vê e pode deixar reações; cada um tira as suas.
CREATE TABLE IF NOT EXISTS public.appreciation_reactions (
  appreciation_id uuid NOT NULL REFERENCES public.appreciations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (appreciation_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS appreciation_reactions_appreciation
  ON public.appreciation_reactions (appreciation_id);

ALTER TABLE public.appreciation_reactions ENABLE ROW LEVEL SECURITY;

-- O EXISTS corre com as regras de appreciations: só reconhecimentos que a pessoa vê.
DROP POLICY IF EXISTS "Reconhecimentos: ver reações" ON public.appreciation_reactions;
CREATE POLICY "Reconhecimentos: ver reações" ON public.appreciation_reactions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.appreciations a WHERE a.id = appreciation_id));

DROP POLICY IF EXISTS "Reconhecimentos: reagir" ON public.appreciation_reactions;
CREATE POLICY "Reconhecimentos: reagir" ON public.appreciation_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.appreciations a WHERE a.id = appreciation_id)
  );

DROP POLICY IF EXISTS "Reconhecimentos: tirar reação" ON public.appreciation_reactions;
CREATE POLICY "Reconhecimentos: tirar reação" ON public.appreciation_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.appreciation_reactions FROM anon;
GRANT SELECT, INSERT, DELETE ON public.appreciation_reactions TO authenticated;
