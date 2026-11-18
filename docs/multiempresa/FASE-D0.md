# Multiempresa · Fase D0: correções da revisão ao PR #53

Migração: `supabase/migrations/20261118120000_multiempresa_fase_d0_correcoes.sql`
Reversão: `supabase/rollbacks/20261118120000_multiempresa_fase_d0_correcoes_rollback.sql`
Ensaio: `supabase/tests/multiempresa_fase_d0_ensaio.sql`

Só funções (não altera tabelas nem restringe leituras). Altera o contrato da C1
(`docs/multiempresa/FASE-C1.md`) nos pontos abaixo; o resto mantém-se.

## O que mudou no contrato

### `rz_company_viewers(p_company uuid)`: nova coluna `is_company_admin`
Devolve agora `user_id, name, email, kind, role, is_company_admin`. `is_company_admin` é verdadeiro
se a pessoa tem pertença de administrador ativa nesta empresa, **mesmo que apareça como
`super_admin`** (a lista mostra cada pessoa uma só vez, com o tipo mais forte). O ecrã conta o último
administrador por aqui. Como o tipo de retorno muda, a função é recriada (DROP + CREATE) e as
permissões repõem-se (`authenticated` e `service_role`, nunca `anon`). O campo é opcional no tipo
`CompanyViewer` (`lib/sharing.ts`): sem ele (resposta antiga) conta-se pelo tipo.

### `rz_add_company_admin` e `rz_remove_company_admin`: login recente
Ambas chamam `rz_assert_recent_auth()` depois de verificar que quem chama é administrador da empresa.
Sem login recente (últimos 10 minutos) falham com `reauth_required` (SQLSTATE `RZ401`). O ecrã abre o
diálogo da palavra-passe (`ReauthDialog`) e repete a chamada uma vez (`useMembershipAction`); se a
pessoa desistir, não há erro; se a base continuar a pedir, aparece "Confirme a sua palavra-passe para continuar.".

### `rz_add_company_admin`: só quem pertence à empresa
`p_user` tem de ter **ficha ativa** nesta empresa (`employees.user_id`) **ou** já ter pertença nela
(qualquer estado: por exemplo um gestor removido que volta). Caso contrário: `not_found`
("Utilizador não encontrado nesta empresa."), a mesma resposta para "não existe" e "é de outra
empresa" (não revela se o utilizador existe). Deixa de se verificar `auth.users` à parte.

### `rz_remove_company_admin`: aviso antes do 23505
Ao passar a colaborador (a pessoa tem ficha ativa na empresa), se já for colaborador ativo noutra
empresa devolve `invalid_argument` com "Esta pessoa já é colaborador ativo noutra empresa. Mova-a ou
desative a outra ficha." Se mesmo assim o índice recusar numa corrida, o `unique_violation` é
convertido na mesma resposta.

### `rz_transfer_employees`: sem erros técnicos em cru
No resultado por ficha, só os códigos do contrato (`not_authenticated`, `forbidden`,
`not_company_admin`, `not_platform_admin`, `reauth_required`, `invalid_argument`, `not_found`,
`last_admin`, `cross_company_violation`) passam com o seu texto em português. Qualquer outro erro
(técnico) vira `error: "unknown"` com `detail: "Não foi possível mover este colaborador. Tente outra vez."`.

## No ecrã (sem mudança de contrato)

- `lib/companyMembership.ts`: `countsAsAdmin`, `adminCount` e `isLastAdmin` contam por `is_company_admin`.
  Um super admin com pertença conta como administrador (e não se retira aqui); um administrador de
  empresa deixa de parecer "o último" só porque o outro é super admin.
- `CompanyAdminsSection`: etiqueta "Administrador da empresa" nos super admins com pertença; diálogo de
  reautenticação.
- `employeeService.create`, `update` e `toggleActive`: o 23505 do índice
  `company_memberships_one_active_employee_uq` (gatilho `employees_sync_membership`) vira a frase em
  português acima, sem código. Outros duplicados (por exemplo, email) não mudam.

## Como correr o ensaio

`supabase/tests/multiempresa_fase_d0_ensaio.sql` é um bloco `DO` que cria dados sintéticos e termina
sempre com `RAISE EXCEPTION 'FP_BEGIN…FP_END'`, o que anula a transação. Correr **depois** de aplicada
a migração, numa só chamada. Lê-se o relatório na mensagem do erro: 18 testes, todos têm de dar OK.
Para provar que os testes distinguem o antes do depois, corre-o também **antes** da migração: os de
`is_company_admin`, reautenticação, utilizador de outra empresa, aviso do 23505 e `unknown` falham.

## Fora do âmbito da D0 (ficam para a Fase D)

- Administrador desativado mantém a pertença de administrador ativa.
- Bloqueio de `UPDATE employees SET company_id` na base (a C3 só o bloqueia no ecrã).
