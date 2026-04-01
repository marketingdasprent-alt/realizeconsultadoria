-- Alterar tipos para suportar meios-dias de férias
ALTER TABLE employee_vacation_balances 
ALTER COLUMN total_days TYPE numeric(5,1) USING total_days::numeric(5,1),
ALTER COLUMN used_days TYPE numeric(5,1) USING used_days::numeric(5,1);

ALTER TABLE absence_periods 
ALTER COLUMN business_days TYPE numeric(5,1) USING business_days::numeric(5,1);