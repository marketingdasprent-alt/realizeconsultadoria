# Avisos de email novo com menos escritas na BD (21/10)

A queda de 21/10 começou às 20:06 UTC de 20/10. Nessa altura quase toda a carga da API vinha
do `rz-mail-poll` (pg_cron, a cada minuto → `mail-api` `poll-new`, `supabase/functions/mail-api/poll.ts`).
Os primeiros pedidos a falhar foram os seus PATCH a `mail_accounts`.

## O que fazia antes

Em cada passagem, para cada caixa ativa (hoje há 20: 14 app-microsoft, 1 oauth-microsoft e 5 IMAP):

1. **Reserva:** `PATCH mail_accounts SET polled_at` com `.or(polled_at.is.null,polled_at.lt.…)`.
   Um pedido por caixa e por minuto. Nas IMAP, um minuto sim, um não, a linha não muda.
2. **`notified_until`:** era regravado **sempre**, mesmo sem emails novos. Comparava
   `toISOString()` (`…06.000Z`) com o texto da BD (`…06+00:00`), que nunca são iguais.
   A BD confirma isto: na caixa oauth-microsoft o `notified_until` ficou em 20/10 19:25, mas o
   `updated_at` acompanhava o `polled_at` (o trigger `mail_accounts_before_write` mexe no
   `updated_at` a cada UPDATE).

O estado da conta (`updateAccountStatus`, em `accounts.ts`) não entra neste ciclo. Na passagem
só é gravado quando a conta passa a `reauth`. Como a passagem só lê contas `active`, essa
escrita é sempre uma mudança verdadeira e acontece uma vez.

## O que faz agora

- **Uma reserva por passagem:** `rpc('mail_poll_claim')` faz um só UPDATE de uma linha em
  `mail_poll_lease` (migração `20261021150000_mail_poll_claim.sql`). A reserva dura 50 s, por
  isso duas passagens nunca leem as caixas ao mesmo tempo. Também diz se as IMAP entram nesta
  passagem (no máximo a cada 110 s, como antes). Sem reserva, a passagem acaba logo, sem
  SELECT, sem drivers e sem UPDATE.
- **`notified_until` só quando chega email:** compara o instante (`newest > since`), não o
  texto. Também grava na primeira passagem de uma caixa (marca o ponto de partida).
- `mail_accounts.polled_at` deixa de ser usado. A coluna fica, mas sem dados novos.

Testes: `src/lib/__tests__/mail-poll.test.ts` (9 casos, incluindo "20 caixas sem novidades →
0 UPDATE em mail_accounts e 1 reserva"). Com o `poll.ts` antigo, 8 dos 9 falham.

## Estimativa de UPDATE por hora

Contas a 21/10: 20 ativas, 5 delas IMAP. Os avisos de email (`user_notifications`, kind `mail`)
foram 123 a 19/10 e 171 a 20/10.

| | pedidos PATCH/RPC de escrita por hora | linhas UPDATE por hora |
|---|---|---|
| **Antes**, cron a 1 min | ~2250 (20 reservas + ~17,5 `notified_until` por minuto) | **~2100** (24 h → ~50 000/dia) |
| **Depois**, cron a 1 min | 60 reservas + `notified_until` só com email novo | **~70–100** (60 + ~10–40 em horário de trabalho, ~0 de noite) |
| **Depois**, cron a 2 min (proposto) | 30 + idem | **~40–70** |
| **Depois**, cron a 5 min | 12 + idem | **~20–50** |

Os pedidos ao PostgREST por passagem também caem: antes eram 1 SELECT + ~37 PATCH; agora são
1 RPC + 1 SELECT, mais 1 PATCH por caixa com email novo. Os `rz_notify` não mudam.

À noite, sem email, passa a ter **0** escritas em `mail_accounts`. A única escrita é a linha
da reserva.

## Ordem para publicar (precisa do OK do dono)

1. Aplicar a migração (SQL Editor, ou `node scripts/run-sql.mjs supabase/migrations/20261021150000_mail_poll_claim.sql`).
   Só cria a tabela e a função. A mail-api que está publicada continua igual.
   Foi ensaiada a 21/10 dentro de uma transação desfeita (ROLLBACK): a reserva, o bloqueio,
   as IMAP a cada 2 min e as permissões (anon sem acesso) funcionaram.
2. Publicar a mail-api: `supabase functions deploy mail-api --project-ref jvvnsoasylusbmxfotci`.
   Se a função nova for publicada sem a migração, o `poll-new` falha logo no RPC (sem escritas).
3. (Proposto) Mudar o intervalo e reativar o job (ver abaixo).

Para voltar atrás, basta publicar a mail-api anterior. A migração pode ficar.

## SQL proposto para o job (NÃO aplicado)

O job 13 `rz-mail-poll` está pausado desde 21/10, ~11:14 PT. Nos últimos 2 dias teve 2094
falhas "job startup timeout": o pg_cron não conseguia arrancar o job com a máquina sem recursos.

Recomendação: **2 minutos**. As IMAP já só eram lidas de 2 em 2 minutos, e um aviso pode chegar
até 2 min depois do email. Atenção: o mesmo job (`rz_mail_poll()`) também mantém acordadas as
funções `company-files` e `ai-chat`. A 2 min (ou 5 min), a primeira abertura dessas funções
pode demorar mais.

```sql
-- 1) Mudar só o intervalo (o job continua pausado)
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'rz-mail-poll'),
  schedule := '*/2 * * * *'   -- ou '*/5 * * * *'
);

-- 2) Reativar, só depois da migração e da mail-api nova estarem publicadas
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'rz-mail-poll'), active := true);

-- Confirmar
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'rz-mail-poll';
```

Para voltar ao minuto: `cron.alter_job(…, schedule := '* * * * *')`.
