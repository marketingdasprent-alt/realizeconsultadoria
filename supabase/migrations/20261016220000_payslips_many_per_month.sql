-- Realize 2.0 · Vários recibos de vencimento no mesmo mês (ex.: vencimento + subsídio).
-- Antes, cada recibo novo do mês tirava o anterior; agora somam-se, e só um ficheiro com o
-- mesmo nome substitui o que lá estava (voltar a importar o mesmo mês não duplica).

DROP INDEX IF EXISTS public.uq_employee_documents_current_payslip;
CREATE UNIQUE INDEX uq_employee_documents_current_payslip
  ON public.employee_documents (employee_id, period_month, file_name)
  WHERE is_current AND category = 'recibo_vencimento';

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

  -- Retira o "atual" anterior do mesmo tipo. Recibos: um mês pode ter vários; só se
  -- substitui o do mesmo mês com o mesmo nome de ficheiro (reimportar não duplica).
  SELECT id INTO _previous_id
  FROM public.employee_documents
  WHERE employee_id = _doc.employee_id
    AND is_current
    AND id <> _document_id
    AND category = _final_category
    AND (_final_category <> 'recibo_vencimento'
         OR (period_month = _final_period AND file_name = _doc.file_name))
  ORDER BY created_at DESC
  LIMIT 1;

  UPDATE public.employee_documents
  SET is_current = false
  WHERE employee_id = _doc.employee_id
    AND is_current
    AND id <> _document_id
    AND category = _final_category
    AND (_final_category <> 'recibo_vencimento'
         OR (period_month = _final_period AND file_name = _doc.file_name));

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
