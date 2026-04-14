-- Add topic_key and can_execute columns to admin_group_permissions
ALTER TABLE public.admin_group_permissions 
ADD COLUMN IF NOT EXISTS topic_key text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS can_execute boolean NOT NULL DEFAULT false;

-- Drop old unique constraint if exists
ALTER TABLE public.admin_group_permissions 
DROP CONSTRAINT IF EXISTS admin_group_permissions_group_id_module_key_key;

-- Create new unique index including topic_key
CREATE UNIQUE INDEX IF NOT EXISTS admin_group_permissions_unique_idx 
ON public.admin_group_permissions(group_id, module_key, COALESCE(topic_key, ''));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_group_permissions_topic 
ON public.admin_group_permissions(group_id, module_key, topic_key);