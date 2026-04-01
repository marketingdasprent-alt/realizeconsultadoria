-- Add financial fields to employees table
ALTER TABLE public.employees 
ADD COLUMN iban text,
ADD COLUMN cartao_da text,
ADD COLUMN cartao_refeicao text;