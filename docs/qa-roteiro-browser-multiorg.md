# Roteiro de browser por papel (multi-org, PR1 e seguintes)

Executar com contas de teste reais (não o login do João), numa BD de ensaio ou com a migração aplicada.
Registar captura de ecrã por passo. Marcar só o que foi mesmo feito.

## Contas necessárias
| Papel | Estado |
|---|---|
| Super admin (platform_admins) | por criar |
| Admin da empresa A (pertença admin, sem platform_admins) | por criar |
| Colaborador da empresa A | por criar |
| Admin de empresa externa C (sem grupo) | por criar |
| Utilizador de empresa do mesmo grupo (B) | por criar |

## 1. Super admin
1. Login. Esperado: entra no admin com todos os módulos.
2. Definições > Grupos de admin: ver, criar um grupo, adicionar membro, apagar. Esperado: tudo funciona.
3. Empresas: ver todas; criar empresa de teste; apagar essa empresa. Esperado: funciona.
4. Definições > Administradores: nomear admin de uma empresa (pede login recente).

## 2. Admin da empresa A
1. Login. Esperado: entra no admin; vê só módulos de gestão (sem Marketing, Jurídico, Acessos, Ponto, Suporte).
2. Empresas: só vê a empresa A. Abrir `?tab=groups`, `?tab=access`, `?tab=suporte` em Definições: não pode mostrar conteúdo (Visão: SettingsPage.tsx:614-638).
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
