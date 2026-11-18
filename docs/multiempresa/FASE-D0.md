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
`p_user` tem de ter **ficha ativa** nesta empresa (`employees.user_id`) **ou** já ter sido
administrador ou gestor dela (pertença com `role` `admin` ou `gestor`, em qualquer estado: um gestor
removido pode voltar). Caso contrário: `not_found` ("Utilizador não encontrado nesta empresa."), a
mesma resposta para "não existe" e "é de outra empresa" (não revela se o utilizador existe). Deixa de
se verificar `auth.users` à parte. *(A D0 aceitava qualquer pertença; a D0.1 fechou esse buraco, ver
abaixo.)*

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

## D0.1: ajuste a `rz_add_company_admin`

Migração: `supabase/migrations/20261118120500_multiempresa_fase_d0_1_ajuste_add_admin.sql`
Reversão: `supabase/rollbacks/20261118120500_multiempresa_fase_d0_1_ajuste_add_admin_rollback.sql`
(repõe a versão da D0).

A revisão da D0 achou que a condição "pertença existente em qualquer estado" deixava promover fichas
inativas (o gatilho `employees_sync_membership` deixa a pertença `suspenso`) e pessoas já movidas
para outra empresa (pertença `removido`). A D0.1 só muda a segunda condição: exige pertença com
`role IN ('admin','gestor')`, em qualquer estado (mantém o gestor removido que volta). Só
`CREATE OR REPLACE` da função, com a mesma assinatura, `SECURITY DEFINER`, `search_path` fixo,
`rz_assert_recent_auth()` e `EXECUTE` só para `authenticated` e `service_role`.

## Como correr o ensaio (ordem final)

`supabase/tests/multiempresa_fase_d0_ensaio.sql` é um bloco `DO` que cria dados sintéticos e termina
sempre com `RAISE EXCEPTION 'FP_BEGIN…FP_END'`, o que anula a transação. A mensagem vermelha **é o
relatório**, não um erro a corrigir. Cada passo numa única chamada.

| Passo | O que correr | Resultado esperado |
| --- | --- | --- |
| 1 | o ensaio, **antes** da D0 | 12 ok e **10 falhas**: testes 1, 3, 4, 6, 7, 8, 9, 16, 21 e 22 (prova que o ensaio distingue o antes do depois) |
| 2 | a migração D0 (`20261118120000`) | sem erro |
| 3 | a migração D0.1 (`20261118120500`) | sem erro |
| 4 | o ensaio, **depois** da D0.1 | **22 ok, 0 falhas** |

Se parares entre os passos 2 e 3, o ensaio dá 20 ok e 2 falhas (testes 8 e 9: ficha inativa e pessoa
já movida), que é exatamente o que a D0.1 corrige. Qualquer outra falha, ou `ERRO NA PREPARACAO`
(nenhum teste correu), deve parar tudo.

O ensaio confere o código **e o texto** do erro (reautenticação, utilizador não encontrado, aviso da
regra "uma só empresa") e executa o ramo de erro técnico de `rz_transfer_employees`: um gatilho de
teste (anulado no fim) rebenta o `UPDATE` de uma ficha e o resultado tem de ser `unknown` com texto
geral, sem o texto técnico. Pressupõe o gatilho `employees_sync_membership` ativo (o relatório avisa
se faltar).

## Fora do âmbito da D0 (ficam para a Fase D)

- Administrador desativado mantém a pertença de administrador ativa.
- Bloqueio de `UPDATE employees SET company_id` na base (a C3 só o bloqueia no ecrã).
