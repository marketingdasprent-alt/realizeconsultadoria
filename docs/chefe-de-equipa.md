# Chefe de equipa: responsável direto e alcance das permissões

Pedido do Thiago (20/11/2026): grupos de acesso com permissões limitadas à equipa de quem as tem
("Editar colaboradores: só a minha equipa") e organograma que segue a chefia real.

Decisões:
- A equipa de uma pessoa são todos os colaboradores abaixo dela na cadeia de responsável direto
  (subordinados diretos e os subordinados destes, sem limite de níveis). A própria pessoa não conta.
- Cada colaborador tem no máximo um responsável direto, da mesma empresa.
- O limite é aplicado nos ecrãs. O Thiago dispensou o bloqueio no banco (mensagem 1312).
- Primeira fatia: módulo Colaboradores (os 7 tópicos). Pedidos de férias e Ponto ficam para depois.

## Servidor (Moe)

Migração nova `supabase/migrations/20261120120000_chefe_de_equipa.sql`:

1. `employees.manager_id uuid NULL REFERENCES employees(id) ON DELETE SET NULL`
   - `CHECK (manager_id IS NULL OR manager_id <> id)`
   - Gatilho BEFORE INSERT/UPDATE OF manager_id, company_id: recusa responsável de outra empresa
     (mensagem `O responsável direto tem de ser da mesma empresa.`) e ciclos
     (mensagem `Esta escolha criava um ciclo na chefia.`), com ERRCODE `check_violation`.
   - Índice em `manager_id`.
2. `admin_group_permissions.scope text NOT NULL DEFAULT 'all' CHECK (scope IN ('all','team'))`.
   Linhas existentes ficam `all`: nada muda para os grupos atuais.
3. `rz_my_team_employee_ids() RETURNS SETOF uuid`, SQL STABLE SECURITY DEFINER,
   `search_path = public`: ids dos colaboradores abaixo (recursivo) de todas as fichas ligadas à
   identidade de `auth.uid()` (`employees.user_id` ou `employees.admin_user_id` em
   `rz_identity_ids(auth.uid())`). Exclui as próprias fichas. Proteção contra ciclos (UNION, não
   UNION ALL). `GRANT EXECUTE` só a `authenticated`.
4. `chat_directory()` passa a devolver também `manager_employee_id uuid` (última coluna). Resto igual
   à versão de `20261016200000_directory_work_contacts.sql`.
5. Atualizar `src/integrations/supabase/types.ts` (employees.manager_id, admin_group_permissions.scope,
   rz_my_team_employee_ids, chat_directory.manager_employee_id).

Sem políticas RLS novas. Reversão: DROP da função, DROP COLUMN scope e manager_id, chat_directory
da versão anterior.

## Ecrãs (Krusty)

- Grupos de acesso: nos tópicos de Colaboradores, seletor "Todos" / "Só a minha equipa" (grava `scope`).
- `useAdminPermissions`: alcance por tópico (um grupo com `all` ganha a um com `team`) e lista da
  equipa via `rz_my_team_employee_ids()`.
- Colaboradores: com Ver em "Só a minha equipa", a lista mostra só a equipa; ações por linha e na
  ficha respeitam o alcance de cada tópico.
- Ficha: campo "Responsável direto" (mesma empresa, sem a própria pessoa nem quem está abaixo dela).
  Quem cria com alcance de equipa fica como responsável do colaborador novo.
- Organograma: árvore pela chefia real; sem nenhuma chefia preenchida, mantém a vista por
  departamentos.
