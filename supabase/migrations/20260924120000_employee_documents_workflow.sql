-- =============================================================================
-- Documentos do colaborador: aprovação no BackOffice, "documento atual" e recibos
-- =============================================================================
-- Fluxo:
--   * Colaborador submete um documento (ex.: Cartão de Cidadão renovado) →
--     fica 'pending' e aparece no BackOffice para aprovação.
--   * Admin aprova (preenchendo nº do documento, emissão e validade) → passa a
--     'approved' e torna-se o documento ATUAL desse tipo (is_current), retirando
--     o anterior. Rejeita com motivo → 'rejected'.
--   * Recibos de vencimento: categoria 'recibo_vencimento' + period_month
--     (1.º dia do mês). Importados pelo BackOffice, um "atual" por mês.
--   * Uploads do BackOffice ficam aprovados de imediato.
--
-- Tabela e storage (bucket 'employee-files') já existem; aqui só se acrescentam
-- colunas, um trigger de proteção, políticas e a RPC de revisão.
-- =============================================================================

ALTER TABLE public.employee_documents
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS document_number TEXT,
  ADD COLUMN IF NOT EXISTS issue_date DATE,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS period_month DATE,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS replaces_document_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_documents_status_check'
  ) THEN
    ALTER TABLE public.employee_documents
      ADD CONSTRAINT employee_documents_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_documents_period_month_check'
  ) THEN
    ALTER TABLE public.employee_documents
      ADD CONSTRAINT employee_documents_period_month_check
      CHECK (period_month IS NULL OR period_month = date_trunc('month', period_month)::date);
  END IF;
END $$;

-- Um recibo "atual" por colaborador e mês.
CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_documents_current_payslip
  ON public.employee_documents (employee_id, period_month)
  WHERE is_current AND category = 'recibo_vencimento';

CREATE INDEX IF NOT EXISTS idx_employee_documents_status
  ON public.employee_documents (status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_employee_documents_expiry
  ON public.employee_documents (expiry_date) WHERE is_current AND expiry_date IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Dados existentes
-- -----------------------------------------------------------------------------
-- Uploads antigos do colaborador passam a aguardar aprovação (antes eram
-- visíveis sem revisão). Os do BackOffice ficam aprovados.
UPDATE public.employee_documents
SET status = 'pending', is_current = false
WHERE uploaded_by_role = 'employee' AND status = 'approved' AND reviewed_at IS NULL;

-- O documento aprovado mais recente de cada tipo passa a ser o "atual".
UPDATE public.employee_documents d
SET is_current = true
FROM (
  SELECT DISTINCT ON (employee_id, category) id
  FROM public.employee_documents
  WHERE status = 'approved' AND category IS NOT NULL AND category <> 'recibo_vencimento'
  ORDER BY employee_id, category, created_at DESC
) latest
WHERE d.id = latest.id AND NOT d.is_current;

-- -----------------------------------------------------------------------------
-- Proteção: o colaborador nunca insere documentos já aprovados/atuais
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_employee_document_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.uploaded_by_role = 'employee' AND TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.is_current := false;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.review_notes := NULL;
  END IF;
  IF NEW.category = 'recibo_vencimento' AND NEW.period_month IS NULL THEN
    RAISE EXCEPTION 'Recibo de vencimento sem mês (period_month)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employee_documents_submission ON public.employee_documents;
CREATE TRIGGER trg_employee_documents_submission
  BEFORE INSERT ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_employee_document_submission();

-- O colaborador só apaga o que submeteu e ainda não foi revisto.
DROP POLICY IF EXISTS "Employees can delete own submitted documents" ON public.employee_documents;
CREATE POLICY "Employees can delete own submitted documents"
  ON public.employee_documents FOR DELETE
  USING (
    employee_id = (SELECT public.get_employee_id_from_user(auth.uid()))
    AND uploaded_by_role = 'employee'
    AND uploaded_by = auth.uid()
    AND status = 'pending'
  );

-- -----------------------------------------------------------------------------
-- RPC: aprovar / rejeitar (apenas admins)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_employee_document(
  _document_id UUID,
  _decision TEXT,
  _category TEXT DEFAULT NULL,
  _document_number TEXT DEFAULT NULL,
  _issue_date DATE DEFAULT NULL,
  _expiry_date DATE DEFAULT NULL,
  _period_month DATE DEFAULT NULL,
  _notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _doc public.employee_documents%ROWTYPE;
  _final_category TEXT;
  _final_period DATE;
  _previous_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão para rever documentos' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _doc FROM public.employee_documents WHERE id = _document_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento não encontrado';
  END IF;

  IF _decision = 'rejected' THEN
    IF length(trim(COALESCE(_notes, ''))) < 3 THEN
      RAISE EXCEPTION 'Indique o motivo da rejeição';
    END IF;
    UPDATE public.employee_documents
    SET status = 'rejected',
        is_current = false,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_notes = trim(_notes)
    WHERE id = _document_id;
    RETURN;
  END IF;

  IF _decision <> 'approved' THEN
    RAISE EXCEPTION 'Decisão inválida';
  END IF;

  _final_category := COALESCE(NULLIF(trim(_category), ''), _doc.category);
  IF _final_category IS NULL THEN
    RAISE EXCEPTION 'Indique o tipo de documento';
  END IF;
  _final_period := CASE
    WHEN _final_category = 'recibo_vencimento'
      THEN date_trunc('month', COALESCE(_period_month, _doc.period_month))::date
    ELSE NULL
  END;
  IF _final_category = 'recibo_vencimento' AND _final_period IS NULL THEN
    RAISE EXCEPTION 'Indique o mês do recibo';
  END IF;

  -- Retira o "atual" anterior do mesmo tipo (ou do mesmo mês, para recibos).
  SELECT id INTO _previous_id
  FROM public.employee_documents
  WHERE employee_id = _doc.employee_id
    AND is_current
    AND id <> _document_id
    AND category = _final_category
    AND (_final_category <> 'recibo_vencimento' OR period_month = _final_period)
  ORDER BY created_at DESC
  LIMIT 1;

  UPDATE public.employee_documents
  SET is_current = false
  WHERE employee_id = _doc.employee_id
    AND is_current
    AND id <> _document_id
    AND category = _final_category
    AND (_final_category <> 'recibo_vencimento' OR period_month = _final_period);

  UPDATE public.employee_documents
  SET status = 'approved',
      is_current = true,
      category = _final_category,
      document_number = NULLIF(trim(COALESCE(_document_number, '')), ''),
      issue_date = _issue_date,
      expiry_date = _expiry_date,
      period_month = _final_period,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = NULLIF(trim(COALESCE(_notes, '')), ''),
      replaces_document_id = _previous_id
  WHERE id = _document_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_employee_document(UUID, TEXT, TEXT, TEXT, DATE, DATE, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_employee_document(UUID, TEXT, TEXT, TEXT, DATE, DATE, DATE, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_employee_document_submission() FROM PUBLIC, anon, authenticated;
