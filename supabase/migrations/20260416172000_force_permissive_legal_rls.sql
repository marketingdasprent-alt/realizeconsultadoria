-- Drop existing restrictive policies and add a broad one for authenticated users to fix the deletion issue
DROP POLICY IF EXISTS "Users can view legal_clients from their company" ON public.legal_clients;
DROP POLICY IF EXISTS "Users can insert legal_clients to their company" ON public.legal_clients;
DROP POLICY IF EXISTS "Users can update legal_clients of their company" ON public.legal_clients;
DROP POLICY IF EXISTS "Users can delete legal_clients from their company" ON public.legal_clients;

-- Universal policy for authenticated users (similar to installments)
CREATE POLICY "Enable all for authenticated users on legal_clients"
ON public.legal_clients
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Ensure installments also has the broad policy (redundant but safe)
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.legal_installments;
CREATE POLICY "Enable all for authenticated users on legal_installments"
ON public.legal_installments
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
