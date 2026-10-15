# Webmail — configuração (Gmail, Microsoft e IMAP)

O Webmail do Realize usa duas edge functions:

- **`mail-oauth`** — liga contas Google (Gmail / Google Workspace) e Microsoft (Outlook.com,
  Microsoft 365, Exchange Online) por OAuth 2.0 com PKCE. Também é o URI de retorno do OAuth.
- **`mail-api`** — lista, abre, envia e organiza mensagens (Gmail API, Microsoft Graph ou
  IMAP/SMTP) e liga contas IMAP.

Os tokens OAuth e as palavras-passe IMAP ficam no **Supabase Vault**; o browser nunca os recebe.

> Nenhum segredo real deve ficar neste ficheiro, no repositório ou em capturas de ecrã.

---

## 0. Pré-requisitos

1. Migração do Webmail aplicada na BD de produção (`jvvnsoasylusbmxfotci`): tabelas
   `mail_accounts` e `mail_oauth_states` e funções `mail_secret_set`, `mail_secret_get` e
   `mail_account_delete` (com a extensão `supabase_vault` ativa).
2. Supabase CLI com sessão iniciada na conta que tem o projeto `jvvnsoasylusbmxfotci`.
3. URI de retorno do OAuth (igual para Google e Microsoft):

   ```
   https://jvvnsoasylusbmxfotci.supabase.co/functions/v1/mail-oauth
   ```

---

## 1. Google Cloud Console (Gmail e Google Workspace)

1. Abrir <https://console.cloud.google.com> → seletor de projetos → **Novo projeto**
   (ex.: `Realize Webmail`).
2. **APIs e serviços → Biblioteca** → procurar **Gmail API** → **Ativar**.
3. **Ecrã de consentimento OAuth** (Google Auth Platform):
   - **Tipo de utilizador**
     - **Interno** — só contas do Google Workspace da própria organização. Não precisa de
       verificação da Google, mesmo com âmbitos restritos. Recomendado se só forem usadas
       caixas do Workspace da empresa.
     - **Externo** — qualquer conta Google, incluindo `@gmail.com`.
   - Nome da aplicação (`Realize`), email de apoio, domínios autorizados (domínio de produção
     do Realize e `supabase.co`) e email de contacto do programador.
   - **Âmbitos** (Data access → Add or remove scopes):
     - `openid`, `email`, `profile`
     - `https://www.googleapis.com/auth/gmail.modify` (**restrito**)
     - `https://www.googleapis.com/auth/gmail.send` (sensível)
   - **Utilizadores de teste**: enquanto a app estiver em _Testing_ (tipo Externo), só as
     contas adicionadas aqui (máx. 100) conseguem ligar-se, e os refresh tokens **expiram ao
     fim de 7 dias** (a conta passa a "Voltar a ligar").
   - **Produção com tipo Externo**: o `gmail.modify` é um âmbito restrito, por isso a Google
     exige **verificação da app** e uma **avaliação de segurança anual (CASA)** por uma
     entidade externa — demora semanas e tem custo. Com o tipo **Interno** (Workspace) isto
     não é preciso.
4. **Credenciais → Criar credenciais → ID de cliente OAuth**:
   - Tipo de aplicação: **Aplicação Web**; nome: `Realize Webmail`.
   - **URIs de redirecionamento autorizados**:
     `https://jvvnsoasylusbmxfotci.supabase.co/functions/v1/mail-oauth`
   - (As "Origens JavaScript autorizadas" não são precisas.)
   - Guardar o **ID de cliente** e o **Segredo do cliente** num gestor de palavras-passe.

---

## 2. Microsoft Entra ID (Outlook.com, Microsoft 365, Exchange Online)

1. Abrir <https://entra.microsoft.com> (ou portal.azure.com → Microsoft Entra ID) →
   **Registos de aplicações → Novo registo**.
2. Nome: `Realize Webmail`.
3. **Tipos de conta suportados**: _Contas em qualquer diretório organizacional (qualquer
   inquilino do Microsoft Entra ID — multi-inquilino) e contas Microsoft pessoais_.
4. **URI de redirecionamento**: plataforma **Web** →
   `https://jvvnsoasylusbmxfotci.supabase.co/functions/v1/mail-oauth` → **Registar**.
5. Copiar o **ID da aplicação (cliente)** da página de Descrição geral.
6. **Certificados e segredos → Novo segredo do cliente** → validade (ex.: 24 meses) → copiar
   o **Valor** (não o "ID do segredo"; o valor só aparece uma vez). Pôr na agenda a data de
   expiração: quando expirar, ninguém consegue ligar contas Microsoft até ser renovado.
7. **Permissões de API → Adicionar uma permissão → Microsoft Graph → Permissões delegadas**:
   `User.Read`, `Mail.ReadWrite`, `Mail.Send`, `offline_access`, `openid`, `email`, `profile`.
   - Em empresas cujo Microsoft 365 não deixa os utilizadores consentir sozinhos, um
     administrador desse inquilino tem de dar **consentimento de administrador**.
8. (Recomendado) **Verificação do publicador** (Marca e propriedades): sem ela os
   utilizadores veem "não verificado" e alguns inquilinos bloqueiam apps multi-inquilino.

> Exchange **local** (on-premises) não é suportado pelo Graph; nesses casos usar IMAP.

---

## 3. Secrets das funções

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem nas edge functions. Faltam:

| Secret                          | Valor                                                     |
| ------------------------------- | --------------------------------------------------------- |
| `GOOGLE_OAUTH_CLIENT_ID`        | ID de cliente OAuth do Google (`...apps.googleusercontent.com`) |
| `GOOGLE_OAUTH_CLIENT_SECRET`    | Segredo do cliente do Google                              |
| `MICROSOFT_OAUTH_CLIENT_ID`     | ID da aplicação (cliente) do Entra                        |
| `MICROSOFT_OAUTH_CLIENT_SECRET` | Valor do segredo do cliente do Entra                      |
| `MAIL_ALLOWED_ORIGINS`          | Origens para onde se pode voltar depois do OAuth          |

Para não deixar segredos no histórico da shell, usar um ficheiro temporário **fora do
repositório** e apagá-lo a seguir:

```bash
# mail.env (NUNCA fazer commit)
GOOGLE_OAUTH_CLIENT_ID=<id-google>.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=<segredo-google>
MICROSOFT_OAUTH_CLIENT_ID=<id-da-aplicacao>
MICROSOFT_OAUTH_CLIENT_SECRET=<valor-do-segredo>
MAIL_ALLOWED_ORIGINS=http://localhost:8080,https://<dominio-de-producao>
```

```bash
supabase secrets set --project-ref jvvnsoasylusbmxfotci --env-file ./mail.env
supabase secrets list --project-ref jvvnsoasylusbmxfotci   # mostra só resumos (digest)
```

- `MAIL_ALLOWED_ORIGINS` é uma lista separada por vírgulas de **origens exatas**
  (`protocolo://domínio[:porta]`, sem caminho nem `*`). Acrescentar domínios de preview só se
  forem precisos.
- Basta configurar um dos fornecedores: o outro responde `not_configured` até ter credenciais.

---

## 4. Deploy

O `supabase/config.toml` já tem `verify_jwt = false` para as duas funções (o callback do OAuth
chega do browser sem JWT; o `POST` valida o JWT dentro da função).

```bash
supabase functions deploy mail-oauth --project-ref jvvnsoasylusbmxfotci
supabase functions deploy mail-api --project-ref jvvnsoasylusbmxfotci
```

Verificação rápida:

- `GET https://jvvnsoasylusbmxfotci.supabase.co/functions/v1/mail-oauth` sem parâmetros →
  texto "Pedido inválido…" (HTTP 400).
- `POST` a `mail-api` sem sessão → `401 { ok: false, code: 'unauthorized' }`.

### Fluxo OAuth no frontend

1. `supabase.functions.invoke('mail-oauth', { body: { action: 'start', provider: 'gmail',
   redirect_to: <URL atual da página do Webmail> } })` → `data.data.url`.
2. Navegar para esse URL (mesma janela ou popup).
3. No regresso, o URL traz `?mail=ligada` ou `?mail=erro&motivo=<código>`. Motivos:
   `expirado`, `cancelado`, `fornecedor`, `nao_configurado`, `token`, `identidade`,
   `servidor`.

---

## 5. Contas IMAP/SMTP (iCloud, Yahoo, AOL, outros)

- **SMTP só pela porta 465 (SSL/TLS implícito).** A Supabase Edge bloqueia saídas para as
  portas 25 e 587; a `mail-api` recusa outras portas com o código `smtp_port_blocked`.
- **IMAP**: 993 (TLS) recomendado; na 143 usa-se STARTTLS quando o servidor o anuncia.
- O utilizador IMAP/SMTP é o próprio endereço de email.
- **Palavras-passe de aplicação** (obrigatórias com verificação em dois passos):
  - **iCloud**: <https://account.apple.com> → Iniciar sessão e segurança → Palavras-passe
    específicas da app.
  - **Yahoo**: Informações da conta → Segurança da conta → Gerar palavra-passe da app.
  - **AOL**: Segurança da conta → Gerar palavra-passe da app.

| Fornecedor | IMAP                     | SMTP                         |
| ---------- | ------------------------ | ---------------------------- |
| Yahoo      | `imap.mail.yahoo.com:993` | `smtp.mail.yahoo.com:465`    |
| AOL        | `imap.aol.com:993`       | `smtp.aol.com:465`           |
| iCloud     | `imap.mail.me.com:993`   | `smtp.mail.me.com` — a Apple só documenta a 587; **validar se a 465 funciona**, senão o iCloud fica só com leitura |

- Gmail e Outlook devem ser ligados por OAuth (não por IMAP).
- **Por validar depois do deploy**: o IMAP/SMTP usa `imapflow`, `mailparser` e `nodemailer`
  pela compatibilidade Node do Deno. Confirmar no ambiente real: ligação TLS, listagem com
  pré-visualizações, envio pela 465 e cópia na pasta Enviados.

---

## 6. Segurança

- Tokens OAuth (`access_token`, `refresh_token`) e palavras-passe IMAP ficam **encriptados no
  Supabase Vault**. `mail_accounts` guarda só o `secret_id`, que nunca é devolvido ao browser;
  as funções `mail_secret_*` só podem ser executadas pelo `service_role`.
- Todas as operações passam pela `mail-api`, que valida o JWT e só carrega contas com
  `user_id` = utilizador autenticado.
- OAuth com **PKCE (S256)** e `state` aleatório de uso único, apagado na primeira leitura e
  válido 10 minutos. O regresso só vai para origens em `MAIL_ALLOWED_ORIGINS` e o URL só leva
  códigos (`mail`, `motivo`), nunca tokens nem erros do fornecedor.
- Os logs das funções nunca registam tokens nem palavras-passe.
- Ao **desligar** uma conta Google o token é revogado; nas contas Microsoft o utilizador pode
  retirar o acesso em <https://account.live.com/consent/Manage> (pessoais) ou
  <https://myapps.microsoft.com> (empresariais).
- O HTML das mensagens chega tal como foi enviado: o frontend tem de o **sanitizar**
  (ex.: DOMPurify) e mostrá-lo num `iframe` com `sandbox`. Imagens remotas podem ser usadas
  para rastrear a abertura.
- Rodar os segredos dos clientes OAuth periodicamente (o do Entra expira sozinho).

---

## 7. Testes depois do deploy

- [ ] Gmail: ligar conta, listar pastas, pesquisar, abrir, descarregar anexo, enviar,
      responder (fica na mesma conversa), marcar lida/estrela, mover para o lixo, desligar.
- [ ] Microsoft pessoal (Outlook.com) e Microsoft 365: o mesmo.
- [ ] Envio com anexos acima de 4 MB (Gmail e Microsoft usam outro caminho nesse caso).
- [ ] IMAP (Yahoo ou AOL): ligar, listar, abrir, enviar pela 465 e ver a cópia em Enviados.
- [ ] Revogar o acesso no Google/Microsoft e confirmar que a conta passa a "Voltar a ligar".
