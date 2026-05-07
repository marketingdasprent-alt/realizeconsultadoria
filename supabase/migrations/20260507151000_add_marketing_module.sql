-- Criar tabela para histórico de e-mails de marketing
CREATE TABLE public.marketing_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  sender TEXT NOT NULL,
  cc_emails TEXT[],
  recipients_count INTEGER NOT NULL,
  attachments_metadata JSONB,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.marketing_emails ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para marketing_emails
-- Apenas super admins ou admins com permissão marketing podem ver
CREATE POLICY "Admins with marketing access can view emails"
ON public.marketing_emails FOR SELECT
TO authenticated
USING (
  public.has_module_permission(auth.uid(), 'marketing', 'view', 'email') OR
  public.has_module_permission(auth.uid(), 'marketing', 'execute', 'email')
);

CREATE POLICY "Admins with marketing access can insert emails"
ON public.marketing_emails FOR INSERT
TO authenticated
WITH CHECK (
  public.has_module_permission(auth.uid(), 'marketing', 'execute', 'email')
);

-- Criar bucket no storage para anexos temporários/permanentes
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-emails', 'marketing-emails', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para o bucket marketing-emails
CREATE POLICY "Admins with marketing access can view bucket"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'marketing-emails' AND (
    public.has_module_permission(auth.uid(), 'marketing', 'view', 'email') OR
    public.has_module_permission(auth.uid(), 'marketing', 'execute', 'email')
  )
);

CREATE POLICY "Admins with marketing access can insert to bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'marketing-emails' AND
  public.has_module_permission(auth.uid(), 'marketing', 'execute', 'email')
);

CREATE POLICY "Admins with marketing access can update bucket"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'marketing-emails' AND
  public.has_module_permission(auth.uid(), 'marketing', 'execute', 'email')
);

CREATE POLICY "Admins with marketing access can delete from bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'marketing-emails' AND
  public.has_module_permission(auth.uid(), 'marketing', 'execute', 'email')
);

-- Criar o grupo Marketing automaticamente se não existir
DO $$
DECLARE
  v_group_id UUID;
BEGIN
  -- Verificar se já existe um grupo com nome Marketing
  SELECT id INTO v_group_id FROM public.admin_groups WHERE name = 'Marketing' LIMIT 1;
  
  -- Se não existir, criar o grupo
  IF v_group_id IS NULL THEN
    INSERT INTO public.admin_groups (name, description, is_active, is_super_admin)
    VALUES ('Marketing', 'Grupo responsável por comunicações internas e marketing', true, false)
    RETURNING id INTO v_group_id;
  END IF;

  -- Adicionar a permissão do módulo marketing ao grupo Marketing, caso ainda não tenha
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_group_permissions 
    WHERE group_id = v_group_id AND module_key = 'marketing' AND topic_key = 'email'
  ) THEN
    INSERT INTO public.admin_group_permissions (group_id, module_key, topic_key, can_view, can_edit, can_execute)
    VALUES (v_group_id, 'marketing', 'email', true, true, true);
  END IF;
END $$;
