# Multiempresa · Fase C1: funções de base de dados

Migração: `supabase/migrations/20261118110000_multiempresa_fase_c_funcoes.sql`
Reversão: `supabase/rollbacks/20261118110000_multiempresa_fase_c_funcoes_rollback.sql`
Ensaio: `supabase/tests/multiempresa_fase_c_ensaio.sql`

> **Atualizado pela Fase D0** (`docs/multiempresa/FASE-D0.md`): `rz_company_viewers` devolve `is_company_admin`;
> `rz_add_company_admin` e `rz_remove_company_admin` exigem login recente (`reauth_required`);
> `rz_add_company_admin` só aceita quem tem ficha ativa na empresa ou já tem pertença nela;
> `rz_remove_company_admin` avisa em português antes do 23505; `rz_transfer_employees` devolve
> `unknown` para erros técnicos.

Todas as funções são `SECURITY DEFINER`, `search_path = public, pg_temp`, `EXECUTE` só para
`authenticated` e `service_role`. Chamam-se com `supabase.rpc(...)`. Os erros vêm do `rz_fail`:
a mensagem é o código (`error.message`) e o texto em português está em `error.details`.

| Código (`message`) | SQLSTATE | Quando |
| --- | --- | --- |
| `not_authenticated` | 28000 | sem sessão |
| `not_company_admin` | 42501 | não administra a empresa |
| `not_platform_admin` | 42501 | só super admin |
| `invalid_argument` | 22023 | dados inválidos ou regra de negócio violada (ver `details`) |
| `not_found` | 02000 | não existe, ou não é visível a quem chama |
| `last_admin` | 55000 | a empresa ficaria sem administrador ativo |

Super admin passa nas verificações de administrador de qualquer empresa (a `rz_assert_admin` audita
o acesso fora da sua). A auditoria usa `rz_audit_cross` com `action = 'write'`.

## 1. `rz_transfer_employee(p_employee uuid, p_to_company uuid, p_note text DEFAULT NULL) → jsonb`

Move um colaborador de empresa. Atómica.

- **Quem chama:** administrador da empresa de **origem** e da de **destino** (ou super admin).
- **Faz:** `UPDATE employees SET company_id = destino`. O gatilho `employees_sync_membership` marca a
  pertença antiga como `removido` e cria a nova. **Não** toca em ausências, períodos, ponto nem
  saldos: mantêm o `company_id` de origem e o colaborador continua a vê-los (ver "Histórico").
- **Erros:**
  - `not_found` (02000): a ficha não existe ou quem chama não administra a empresa dela;
  - `not_company_admin` (42501): não administra o destino;
  - `not_found`: destino inexistente;
  - `invalid_argument` (22023), com `details` em português: destino igual à origem; destino não
    ativo (`companies.status <> 'ativa'`); ficha inativa; ficha sem `user_id`; email já existe no
    destino; a conta tem outra ficha ativa; a conta já é colaborador ativo noutra empresa
    (evita o 23505 do índice `company_memberships_one_active_employee_uq`).
- **Devolve:**
  ```json
  {
    "employee_id": "uuid", "from_company": "uuid", "to_company": "uuid", "note": "texto|null",
    "pending_effects": {
      "tasks_open_assigned": 0,        // tarefas não concluídas atribuídas (empresa de origem)
      "tasks_open_participant": 0,     // tarefas não concluídas em que é participante
      "events_future_attending": 0,    // eventos futuros em que é convidado (não dono)
      "events_future_owned": 0,        // eventos futuros de que é dono
      "folders_assigned": 0,           // pastas atribuídas (folder_assignments)
      "chat_conversations_origin": 0   // conversas da empresa antiga em que é membro, sem o canal Geral
    }
  }
  ```
  São só contagens, **nada é alterado**. Tarefas, eventos e conversas ficam na empresa de origem; as
  pastas atribuídas seguem a ficha (o administrador deve revê-las).
- `p_note` é devolvido mas **não é guardado** (a auditoria não tem campo de texto livre).
- **Auditoria:** duas linhas (`resource_type = 'employee_transfer'`, `resource_id` = ficha), uma por
  empresa (origem e destino).

## 2. `rz_transfer_employees(p_employees uuid[], p_to_company uuid) → jsonb`

Em massa (1 a 200 fichas, sem repetidas). Verifica primeiro que quem chama administra o destino
(senão falha tudo com `not_company_admin`). Depois chama a função anterior por ficha, cada uma no
seu bloco: uma ficha má falha sozinha, as outras seguem.

```json
{ "total": 3, "ok": 2, "failed": 1,
  "results": [
    { "employee_id": "uuid", "ok": true,  "result": { /* igual a rz_transfer_employee */ } },
    { "employee_id": "uuid", "ok": false, "error": "invalid_argument", "detail": "texto em português" }
  ] }
```

## 3. Histórico que acompanha a pessoa (políticas RLS aditivas)

Só `SELECT`, `TO authenticated`; não alteram nenhuma política existente.

- `absences`: "Colaborador vê as suas ausências (qualquer empresa)" (por `employee_id` da própria ficha).
- `absence_periods`: "Colaborador vê os seus períodos de ausência (qualquer empresa)".

Já estavam cobertos por `employee_id`: ponto (`time_clock_entries`), saldos
(`employee_vacation_balances`) e documentos de ausência (`absence_documents`). O histórico de
alterações e as tentativas de ponto (`time_clock_entry_history`, `time_clock_attempts`) só têm
política para administradores: o colaborador nunca as leu, não muda nada.

## 4. Administradores

### `rz_add_company_admin(p_company uuid, p_user uuid, p_role text DEFAULT 'admin') → jsonb`

- **Quem chama:** administrador da empresa (ou super admin).
- **Faz:** `p_role` é `admin` ou `gestor`. Faz upsert da pertença (empresa, conta) com `role = p_role`
  e `status = 'ativo'`. Se a conta já era colaborador, **promove** a mesma pertença (não duplica) e
  mantém a origem. Se já era admin e se pede `gestor`, passa a gestor (o gatilho protege o último).
- **Erros:** `not_company_admin`; `invalid_argument` (papel inválido); `not_found` (utilizador não existe).
- **Devolve:** `{ company_id, user_id, role, previous_role }` (`previous_role` é `null` se não tinha pertença).
- **Auditoria:** `resource_type = 'company_admin'`, `resource_id` = utilizador.

### `rz_remove_company_admin(p_company uuid, p_user uuid) → jsonb`

- **Quem chama:** administrador da empresa (ou super admin).
- **Faz:** retira um admin ou gestor. Se a pessoa é também colaborador ativo desta empresa, passa a
  `colaborador` ativo (não perde o acesso como colaborador); senão a pertença fica `removido`.
- **Erros:** `not_company_admin`; `not_found` (não é admin/gestor desta empresa); `last_admin` (55000)
  se fosse o último administrador ativo, com mensagem própria quando é o próprio a retirar-se.
  O gatilho `rz_membership_guard` continua a recusar numa corrida.
- **Devolve:** `{ company_id, user_id, previous_role, role, status }`.
- **Auditoria:** `resource_type = 'company_admin'`.

## 5. `rz_create_company(p_name text, p_nif text, p_email text, p_group uuid DEFAULT NULL, p_group_name text DEFAULT NULL, p_admin_user uuid DEFAULT NULL) → jsonb`

- **Quem chama:** só super admin (`not_platform_admin`, 42501, senão).
- **Faz, numa só transação:** cria a empresa (`status = 'ativa'`, `registered_at = now()`), a pertença
  `admin` ativa de `p_admin_user` e, se houver grupo, liga-a: `p_group` (existente) **ou**
  `p_group_name` (grupo novo); os dois ao mesmo tempo é erro; nenhum, fica sem grupo.
- `p_admin_user` é obrigatório, mas tem `DEFAULT NULL` porque o Postgres não permite um parâmetro sem
  valor por omissão depois de um com valor (é validado dentro da função).
- **Erros:** `invalid_argument` (nome/NIF/email em falta ou email sem `@`; sem administrador; NIF
  repetido; grupo e nome de grupo em simultâneo); `not_found` (administrador ou grupo inexistente).
- **Devolve:** `{ company_id, group_id, admin_user_id }` (`group_id` é `null` se sem grupo).
- **Auditoria:** `resource_type = 'company_create'`, `resource_id` = empresa nova.

## Notas para a UI (Fase C2)

- Mostrar `error.details` ao utilizador; usar `error.message` para decidir o comportamento.
- Depois de mover, mostrar `pending_effects` para o administrador rever tarefas, eventos, pastas e conversas.
- Tarefas, eventos e conversas **não** seguem o colaborador: ficam na empresa onde foram criados.
