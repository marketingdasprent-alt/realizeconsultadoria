# Roteiro de browser por papel (multi-org, PR1 e seguintes)

Executar com contas de teste reais (não o login do João), numa BD de ensaio ou com a migração aplicada.
Registar captura de ecrã por passo. Marcar só o que foi mesmo feito.

> **AVISO — nunca em produção.** Os passos que criam e apagam empresas, grupos e administradores (secção 1.2, 1.3, 1.4 e 6.3) só se executam numa BD de ensaio. Em produção só o super admin os pode fazer e só se o João autorizar, caso a caso. Sem essa autorização, na BD real corre-se apenas a matriz SQL em transação anulada (`supabase/tests/multiempresa_isolamento_matriz.sql`, termina sempre em ROLLBACK).

## Contas necessárias
| Papel | Estado |
|---|---|
| Super admin (platform_admins) | sem login no Vault (24/11/2026) |
| Admin da empresa A (pertença admin, sem platform_admins) | sem login no Vault (24/11/2026) |
| Colaborador da empresa A | sem login no Vault (24/11/2026) |
| Admin de empresa externa C (sem grupo) | sem login no Vault (24/11/2026) |
| Utilizador de empresa do mesmo grupo (B) | sem login no Vault (24/11/2026) |

## 1. Super admin
1. Login. Esperado: entra no admin com todos os módulos.
2. Definições > Grupos de admin: ver, criar um grupo, adicionar membro, apagar. Esperado: tudo funciona.
3. Empresas: ver todas; criar empresa de teste; apagar essa empresa. Esperado: funciona.
4. Definições > Administradores: nomear admin de uma empresa (pede login recente).

## 2. Admin da empresa A
1. Login. Esperado: entra no admin; vê só módulos de gestão (sem Marketing, Jurídico, Acessos e Suporte; o Ponto da empresa A vê, desde o PR3).
2. Empresas: só vê a empresa A. Abrir `?tab=groups` e `?tab=suporte` em Definições: não pode mostrar conteúdo (cai no perfil; SettingsPage.tsx:141-148). `?tab=access` abre (permissão `settings:admins`); registar o que lista e confirmar que não mostra administradores de outras empresas.
3. Editar contactos da empresa A (nome, email, telefone): grava. Editar NIF/estado: recusado.
4. Tentar apagar a empresa A: não pode (sem botão, ou erro claro; nunca "apagada com sucesso").
5. Colaboradores: só os da empresa A (PR3). Pelo DevTools > Network, repetir o GET a `companies?id=eq.<id de B/C>`: 0 linhas.
6. Pelo DevTools, `POST /rest/v1/user_roles` com `{"user_id":"<conta>","role":"admin"}`: 403 (42501).
7. Pelo DevTools, `POST /rest/v1/admin_group_members` para o grupo "Super Admin": 403.
8. Convite de admin para a empresa A: aceite; para a empresa B/C: recusado.

## 3. Colaborador da empresa A
1. Login. Esperado: entra no Workspace, não no admin. `/admin` redireciona.
2. Feed e organograma: só da empresa A (e feed do grupo em leitura).
3. DevTools: `GET /rest/v1/user_roles?select=*` devolve só as suas linhas; `GET companies` só a sua.

## 4. Admin de empresa externa C
1. Login. Esperado: entra no admin; só vê a empresa C.
2. Feed e organograma vazios/próprios; não aparece nada da Realize (A/B).
3. Repetir os passos 2.5 a 2.8 contra a empresa A: tudo recusado.

## 5. Utilizador de B (mesmo grupo que A)
1. Feed: vê publicações de A em leitura; não comenta nem publica em A.
2. Colaboradores/ausências/ponto de A: não vê.

## 6. Passos acrescentados depois do PR3 e PR4 (produção)
1. Colaborador com pertença em duas empresas (caso Ana): pedir ausência e ticket na segunda empresa; a empresa gravada tem de ser a escolhida. Na BD real a Ana tem a pertença da Realize removida, por isso o pedido fica na empresa da ficha.
2. Admin de empresa A: Ponto da empresa A visível; Acessos, Suporte, Marketing e Jurídico escondidos (permissions-config.ts, COMPANY_ADMIN_EXCLUDED_MODULES).
3. Super admin (só em BD de ensaio, ver aviso): criar empresa externa com o 1.º admin (NIF de 9 dígitos); o admin convidado entra só nessa empresa, vê Feed e Organograma vazios e próprios; apagar a empresa de teste no fim.
4. Admin com duas empresas (ex.: Paulo, 5 externas + colaborador na Realize): confirmar que o seletor de empresa só mostra as suas e que a Realize só aparece como colaborador.
