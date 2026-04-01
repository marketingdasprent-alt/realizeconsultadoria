
CREATE TABLE public.support_ticket_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('admin', 'employee')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;

-- Employees can view replies on their tickets
CREATE POLICY "Employees can view replies on their tickets"
ON public.support_ticket_replies FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets st
    JOIN public.employees e ON e.id = st.employee_id
    WHERE st.id = support_ticket_replies.ticket_id AND e.user_id = auth.uid()
  )
);

-- Employees can reply to their tickets
CREATE POLICY "Employees can reply to their tickets"
ON public.support_ticket_replies FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND sender_role = 'employee'
  AND EXISTS (
    SELECT 1 FROM public.support_tickets st
    JOIN public.employees e ON e.id = st.employee_id
    WHERE st.id = support_ticket_replies.ticket_id AND e.user_id = auth.uid()
  )
);

-- Admins can view all replies
CREATE POLICY "Admins can view all replies"
ON public.support_ticket_replies FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can reply to tickets
CREATE POLICY "Admins can reply to tickets"
ON public.support_ticket_replies FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND sender_role = 'admin'
  AND public.has_role(auth.uid(), 'admin')
);

-- Enable realtime for replies
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_replies;
