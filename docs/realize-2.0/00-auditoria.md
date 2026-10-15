# Realize 2.0 — Fase 0: inventário da área do colaborador

> Levantamento feito a 15/10/2026 no branch `realize-colaboradores-2.0`, antes da reconstrução.
> Serve de referência para a regra §30 do briefing: nenhuma funcionalidade ou regra atual se perde.
> Caminhos relativos à raiz do projeto, no formato `ficheiro:linha`.

## 1. Rotas, proteção e papéis

| Rota (antes da 2.0) | Página | Notas |
|---|---|---|
| `/colaborador/login` | `EmployeeLoginPage` | pública |
| `/colaborador` | `EmployeeHomePage` | **na 2.0 passa a ser o Messenger** |
| `/colaborador/pedidos` | `EmployeeDashboard` (férias e ausências, 1047 linhas) | |
| `/colaborador/tickets` | `EmployeeTicketsPage` | |
| `/colaborador/documentos` | `EmployeeDocumentsPage` | |
| `/colaborador/ponto` | `EmployeeTimeClockPage` | |
| `/colaborador/avisos` | `EmployeeNoticesPage` | no menu da 2.0 aparece como "Feed" |
| `/colaborador/mais` | `EmployeeMorePage` | |
| `/ponto/nfc` | `TimeClockNfcPage` | `ProtectedRoute` sem papel, `WorkdayProvider` próprio |
| `/instalar`, `/eliminar-conta`, `/auth/callback`, `/auth/set-password` | públicas | |

- `ROUTES.EMPLOYEE` em `src/lib/constants.ts:56-67`. Há rotas escritas à mão em `EmployeeDashboard.tsx:160,255`, `EmployeeTicketsPage.tsx:96,107`, `EmployeeLoginPage.tsx:18-28` e `ProtectedRoute.tsx:45-46`.
- Atalhos por query string: `?novo=1` (pedidos, tickets), `?enviar=1&tipo=` (documentos).
- **Papel** (`src/modules/admin/services/accessService.ts:57-96`): `user_roles` → RPC `get_admin_permissions` → linha em `employees`. Contas com várias linhas em `user_roles` falham o `maybeSingle` (existe `repair-mixed-account`).
- `company_admin` existe no enum, mas `user_roles` **não tem `company_id`** e o `ComingSoonPage` manda-o para `/colaborador`, onde o `ProtectedRoute` (que exige `employee`) o volta a mandar para o login. É um ciclo possível.
- O `EmployeeLoginPage` não usa `AuthContext.login`: faz `signInWithPassword` diretamente e confirma a linha em `employees`.

## 2. Regras de negócio — Férias e ausências (`EmployeeDashboard.tsx`)

| # | Regra | Onde |
|---|---|---|
| 1 | O tipo é obrigatório; em formação, o modo (online/presencial) também. | 301-317 |
| 2 | Vários períodos por pedido; dia completo ou parcial por horas (08:00–18:00, 30 min); períodos de vários dias são sempre completos. | `MultiPeriodSelector.tsx:110-130, 256-342` |
| 3 | Dias úteis sem fins de semana nem feriados; parcial = horas ÷ 8 (arredondado a 0,25). `business_days` calculado **no cliente** na criação. | `vacation-utils.ts:64-104` |
| 4 | **48 h de antecedência só para férias.** Cliente + trigger `check_absence_notice_period`; admins isentos. | 343-360; `20260708120000_notice_period_vacation_only.sql` |
| 5 | Sem sobreposição com pedido pendente (cliente compara o intervalo min/max; trigger na BD). | 362-383; `20260706120000_…sql` |
| 6 | Sem sobreposição com ausência aprovada (`findApprovedConflicts`; parciais no mesmo dia permitidos se não se cruzarem). Triggers sem isenção para admin. | 385-410; `absence-overlap.ts`; `20260723120000_…sql` |
| 7 | Limite de férias: só **aviso visual**, não bloqueia. | 554-569 |
| 8 | Criação: `absences` + `absence_periods` (não atómico). Anexos PDF/JPG/PNG/WEBP até 20 MB, máx. 5 (`absence-documents`). Email aos RH por `send-absence-notification`. | 412-509 |
| 9 | Estados pendente / aprovado / rejeitado / **parcialmente aprovado** (badge por período, rejeitados riscados, motivo/nota). | 103-115, 902-981 |
| 10 | Remarcar/Editar férias futuras aprovadas ou pendentes → RPC `reschedule_vacation` (volta a pendente, recalcula dias no servidor, ≥ 48 h, sem conflitos). Não envia email. | 795-819; `20260915120000_edit_pending_vacations.sql` |
| 11 | Cancelar pendentes ou rejeitados (apaga documentos, períodos, ausência; ficheiros ficam no storage; sem email). | 268-298 |
| 12 | Anexar documentos depois (qualquer estado) e consultá-los. | 856-883 |
| 13 | Saldo: o trigger `recalculate_vacation_used_days` só conta `approved` — `partially_approved` não desconta (**a confirmar se é intencional**). | `20260122174345_…sql` |

Componentes: `VacationBalanceCard`, `EmployeeCalendar` (semana começa ao domingo), `MultiPeriodSelector` (também usado pelo admin), `DocumentUploader`, `AddDocumentsDialog`, e do admin `AbsenceEditDialog` (900 linhas) e `AbsenceDocumentsDialog`.

## 3. Ponto (`src/modules/timeclock`)

- Contexto `WorkdayContextValue` (`context/workdayContext.ts:17-31`): `employee`, `workday` (status, `workedMs`, `breakMs`, `canContinue`…), `run(action, {note, method, tag, at})`, `warmUp`, `refetch`, `version`.
- `WorkdayProvider` lê registos de ontem a +2 dias, recarrega no `visibilitychange`; `usePunch` regista mesmo sem GPS.
- Componentes reutilizáveis: `WorkdayPanel` (agora com `hideTimeline`), `WorkdayClockButton`, `WorkdayActions`, `useMyTimeClock`.
- Servidor: edge `clock-punch` → RPC `time_clock_register_punch` (máquina de estados, duplicados < 60 s, "Retomar dia", correção com `at`). RPCs `time_clock_swap_own_entry` e `time_clock_undo_own_entry` sem uso no frontend.
- Chave do mês em UTC (`EmployeeTimeClockPage.tsx:21`).

## 4. Tickets

- Departamento obrigatório; assuntos por departamento; **prioridade = `default_priority` do assunto** (ou `medium`).
- Anexos: máx. 5, **10 MB**, JPEG/PNG/WEBP/GIF/PDF, só na criação (uploads falhados ignorados em silêncio).
- Emails: RH na criação e a cada resposta; colaborador quando o admin muda o estado ou responde.
- Conversa em tempo real (`support_ticket_replies`, canal `employee-ticket-replies-{id}`).
- Bloqueio de respostas após `resolved`/`closed` **só na interface** (o RLS não verifica o estado).

## 5. Documentos

- Tabs Atuais / Recibos / Enviados; colaborador envia → `pending`; admin aprova (RPC `review_employee_document`).
- Máx. 15 MB; câmara ou ficheiro; só apaga os seus pendentes; validade com aviso aos 60 dias.
- Download abre a janela antes do `await` (iOS).

## 6. Avisos

- `notifications` + `notification_reads`; segmentação global / empresa / individual (cliente + RLS); `expires_at` só no RLS.
- Abrir a página marca tudo como lido. Sem tempo real nem push.

## 7. Conta e acesso

- Login com email/palavra-passe, recuperação por `recover-password` (Brevo), primeiro acesso por email de boas-vindas.
- `SetPasswordPage`: mínimo 8; no ecrã de erro manda colaboradores para `/admin/login` (bug).
- `ChangePasswordDialog`: mínimo 8, confirma a atual com novo `signInWithPassword`.
- `AuthCallbackPage` chama `create-session-transfer` (não existe) e `/auth/pwa` (não é rota).
- `DeleteAccountPage` só abre um `mailto:`.
- `ERROR_MESSAGES.VALIDATION.PASSWORD_MIN_LENGTH` diz 6, a regra real é 8.

## 8. Base de dados

- **Não existe "organização"** acima de `companies`. Departamento é texto livre em `employees.department` (`support_departments` só serve tickets).
- RLS: o colaborador **vê as linhas dos colegas da empresa em `employees`, incluindo `iban` e `document_number`** (`20260105165739_…sql:162-165`), vê as ausências da empresa e pode atualizar a sua própria linha.
- Storage privado: `absence-documents`, `employee-files`, `ticket-attachments`.
- Realtime só em `support_ticket_replies`.

## 9. Segurança — a tratar

1. **Segredos no repositório:** `.claude/settings.local.json` e `migrate.mjs` estão no git com a palavra-passe da BD, o token `sbp_` e chaves `service_role`. Rodar as chaves e retirar os ficheiros do git.
2. RLS de `employees` expõe IBAN e nº de documento aos colegas — tem de mudar antes do Messenger listar colegas (usar uma vista só com dados profissionais).
3. As funções `send-*-notification` não validam o `Authorization` e interpolam texto do utilizador no HTML sem escapar.
4. O email de boas-vindas envia a palavra-passe em claro.

## 10. Testes existentes

Cobertos: remarcar/editar no Dashboard, `AbsenceEditDialog`, `WorkdayPanel`/`WorkdayClockButton`, NFC, regras de jornada, sobreposições (exceto `findApprovedConflicts`), documentos, autenticação.
**Sem testes:** Layout, Tickets, Avisos, Documentos (UI), Login/SetPassword/ChangePassword, `MultiPeriodSelector`, `VacationBalanceCard`, `vacation-utils`, criação/cancelamento de pedidos. → Antes de redesenhar Férias e Tickets (Fase 3) é preciso escrever testes de regressão.

## 11. Código morto e duplicações

- Morto: `SupportSection.tsx`, `refreshAbsences`, `usePWAUpdate`, `auth_preference`, schemas Zod sem uso, `getBusinessDaysBreakdown`, fluxo `session_transfers`.
- Duplicado: leitura do colaborador atual (8 sítios), logout (3 comportamentos), saldo de férias (3), regra das 48 h (5), feriados (4), `formatFileSize` (4), download com vários buckets (3).
- Acima de 150 linhas: EmployeeDashboard, NewTicketDialog, EmployeeLoginPage, EmployeeTicketsPage, MultiPeriodSelector, TicketConversationDialog, EmployeeCalendar, entre outros.
