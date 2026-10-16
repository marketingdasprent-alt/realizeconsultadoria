-- Realize 2.0 · Os documentos pessoais e os recibos passaram para Definições → Os meus
-- documentos (a página Documentos fica para o futuro editor). As notificações de documentos
-- passam a abrir o sítio novo (as antigas continuam a funcionar: a página antiga reencaminha).
DO $$
DECLARE
  v_def text := pg_get_functiondef('public.notify_employee_document'::regproc);
BEGIN
  EXECUTE replace(v_def, '/colaborador/documentos', '/colaborador/definicoes/documentos');
END $$;
