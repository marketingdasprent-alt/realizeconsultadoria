-- Ensaio do D2. NÃO altera nada de forma permanente: termina SEMPRE com RAISE EXCEPTION (anula a
-- transação); o relatório vem na mensagem do erro, entre FP_BEGIN e FP_END.
-- Correr DEPOIS da migração 20261119100000. Esperado: 6 ok, 0 falhas.
-- Pré-requisito: existir pelo menos uma ficha com user_id não nulo e outra sem user_id.
DO $t$
DECLARE
  f_com uuid; f_sem uuid; u_com uuid; u_outro uuid;
  v_rep text := ''; v_ok int := 0; v_ko int := 0; v_msg text;
BEGIN
  SELECT id, user_id INTO f_com, u_com FROM employees WHERE user_id IS NOT NULL LIMIT 1;
  SELECT id INTO f_sem FROM employees WHERE user_id IS NULL LIMIT 1;
  SELECT user_id INTO u_outro FROM employees WHERE user_id IS NOT NULL AND user_id <> u_com LIMIT 1;
  IF f_com IS NULL OR u_outro IS NULL THEN
    RAISE EXCEPTION 'FP_BEGIN ERRO NA PREPARACAO: faltam fichas com conta FP_END';
  END IF;

  -- Sem auth.uid() (SQL Editor / service role): passa.
  BEGIN UPDATE employees SET email = email WHERE id = f_com; v_ok := v_ok + 1;
  EXCEPTION WHEN OTHERS THEN v_ko := v_ko + 1; v_rep := v_rep || ' [1 falhou: ' || SQLERRM || ']'; END;

  -- Como utilizador autenticado (u_outro, não dono da ficha f_com).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_outro, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  BEGIN UPDATE employees SET user_id = u_outro WHERE id = f_com; v_ko := v_ko + 1; v_rep := v_rep || ' [2 devia falhar]';
  EXCEPTION WHEN insufficient_privilege THEN v_ok := v_ok + 1; WHEN OTHERS THEN v_ok := v_ok + 0; v_rep := v_rep || ' [2 outro erro: ' || SQLERRM || ']'; END;

  BEGIN UPDATE employees SET email = 'x-' || email WHERE id = f_com; v_ko := v_ko + 1; v_rep := v_rep || ' [3 devia falhar]';
  EXCEPTION WHEN insufficient_privilege THEN v_ok := v_ok + 1; WHEN OTHERS THEN v_rep := v_rep || ' [3 outro erro: ' || SQLERRM || ']'; END;

  IF f_sem IS NOT NULL THEN
    BEGIN UPDATE employees SET user_id = gen_random_uuid() WHERE id = f_sem; v_ko := v_ko + 1; v_rep := v_rep || ' [4 devia falhar]';
    EXCEPTION WHEN insufficient_privilege THEN v_ok := v_ok + 1; WHEN OTHERS THEN v_rep := v_rep || ' [4 outro erro: ' || SQLERRM || ']'; END;
    -- Ligar a ficha sem conta ao próprio utilizador passa o gatilho (a RLS pode ainda recusar com 0 linhas).
    BEGIN UPDATE employees SET user_id = u_outro WHERE id = f_sem; v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN v_ko := v_ko + 1; v_rep := v_rep || ' [5 falhou: ' || SQLERRM || ']'; END;
  END IF;

  -- Campos sem relação continuam livres.
  BEGIN UPDATE employees SET updated_at = now() WHERE id = f_com; v_ok := v_ok + 1;
  EXCEPTION WHEN OTHERS THEN v_ko := v_ko + 1; v_rep := v_rep || ' [6 falhou: ' || SQLERRM || ']'; END;

  RAISE EXCEPTION 'FP_BEGIN ok=% falhas=% % FP_END', v_ok, v_ko, v_rep;
END
$t$;
