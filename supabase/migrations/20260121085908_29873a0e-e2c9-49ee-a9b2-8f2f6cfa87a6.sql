-- Add default_priority column to support_ticket_subjects
ALTER TABLE support_ticket_subjects 
ADD COLUMN default_priority text NOT NULL DEFAULT 'medium';

-- Update existing subjects with suggested priorities
UPDATE support_ticket_subjects SET default_priority = 'high' WHERE label ILIKE '%acesso%' OR label ILIKE '%login%' OR label ILIKE '%erro%';
UPDATE support_ticket_subjects SET default_priority = 'low' WHERE label ILIKE '%dúvida%' OR label ILIKE '%alteração%' OR label ILIKE '%dados%';