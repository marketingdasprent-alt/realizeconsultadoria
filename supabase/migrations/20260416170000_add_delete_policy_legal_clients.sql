-- Add DELETE policy for legal_clients
CREATE POLICY "Users can delete legal_clients from their company"
    ON public.legal_clients FOR DELETE
    USING (
      company_id IN (
        SELECT id FROM public.companies WHERE id = legal_clients.company_id
      )
    );

-- Also add for legal_installments just in case cascades aren't fully permissive
CREATE POLICY "Users can delete legal_installments from their company"
    ON public.legal_installments FOR DELETE
    USING (
      client_id IN (
        SELECT id FROM public.legal_clients WHERE id = legal_installments.client_id
      )
    );
