# Recuperação de autenticação IMAP

## Contrato do servidor

- Mantém as ações e campos públicos de `mail-api`, sem novas rotas ou migrações.
- Falhas explicitamente temporárias durante o login (indisponibilidade, limitação,
  tempo esgotado ou ligação interrompida) devolvem `provider_error`. Não exigem
  uma palavra-passe nova nem passam a conta para `reauth`.
- Uma recusa de autenticação continua a devolver `reauth`, sem afirmar que houve
  uma troca de palavra-passe.
- A rotina existente `poll-new` volta a verificar contas IMAP em `reauth`, no máximo
  uma vez a cada 30 minutos por conta. A reserva atómica na base mantém esse limite
  entre execuções concorrentes e depois de reinícios.
- A recuperação só lê a lista da Entrada, com limite de uma mensagem e sem excertos.
  Não abre corpos, aplica regras, avisa pessoas, envia ou repete envios nessa tentativa.
- Só depois de uma leitura bem-sucedida e dentro do prazo de 20 segundos a conta
  pode voltar a `active`, com `last_error = null`. O estado e a versão da reserva
  têm de continuar iguais; uma alteração concorrente impede a reativação.
- Se falhar ou expirar o prazo, permanece em `reauth`. Credenciais inválidas não
  provocam um ciclo rápido de tentativas: a próxima verificação respeita os 30 minutos.
- Contas OAuth em `reauth` e contas em `error` não entram nesta recuperação.
- Após recuperar, a passagem seguinte usa o fluxo normal, preservando
  `notified_until`, permissões, membros, regras e credenciais existentes.

## Publicação e reversão

Alteração local, sujeita a teste e autorização de publicação do Thiago. Sem alterações
de esquema. Para reverter, republicar a versão anterior de `mail-api`; as contas
já recuperadas continuam com o seu estado normal.
