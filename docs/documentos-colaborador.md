# Documentos do colaborador e recibos de vencimento

## Fluxo

| Quem | O que faz | Resultado |
|---|---|---|
| Colaborador (app → Documentos → Enviar) | Tira foto/escolhe ficheiro, indica tipo, nº e validade | Fica **"Aguarda aprovação"** |
| RH (BackOffice → Documentos → Por aprovar) | Vê o ficheiro, confirma tipo/nº/validade e **Aprova** ou **Rejeita** com motivo | Aprovado → passa a ser o **documento atual** desse tipo; o anterior fica arquivado |
| RH (BackOffice → Documentos → Recibos de vencimento) | Importa o recibo do mês por colaborador, ou vários ficheiros de uma vez | Colaborador vê em Documentos → Recibos |
| RH (BackOffice → Documentos → Validades) | Lista de documentos expirados ou a expirar em 60 dias | — |

Uploads feitos no BackOffice (ficha do colaborador → Documentos → Carregar) ficam aprovados de
imediato e substituem o documento atual do mesmo tipo.

### Tipos de documento

Um exemplar "atual" por tipo: Cartão de Cidadão, Passaporte, Título de Residência, Carta de
Condução, NIF, NISS, Comprovativo de Morada, Comprovativo de IBAN, Certificado de Habilitações,
Ficha de Aptidão Médica, Contrato, Ficha de Admissão. Vários exemplares: Recibo de Vencimento
(um atual por mês), Certificado, Comunicado, Outro.

### Importação de recibos em lote

Em **Recibos de vencimento → Importar vários ficheiros**, cada ficheiro é associado ao colaborador
pelo **nome no nome do ficheiro** (ex.: `Recibo_2026-09_Joao_Silva.pdf`). Aceita nome completo,
primeiro + último nome ou o nº de documento. Ficheiros sem correspondência (ou ambíguos, como dois
"Silva") aparecem para escolher manualmente antes de importar. Um recibo novo para o mesmo mês
substitui o anterior.

## Base de dados

Migração `supabase/migrations/20260924120000_employee_documents_workflow.sql` (correr no SQL
Editor do projeto `jvvnsoasylusbmxfotci` **antes** de publicar o frontend):

- `employee_documents` ganha `status` (pending/approved/rejected), `document_number`,
  `issue_date`, `expiry_date`, `period_month`, `is_current`, `reviewed_by/at`, `review_notes`,
  `replaces_document_id`.
- Trigger força `pending` em tudo o que o colaborador insere; só admins mudam o estado, através da
  RPC `review_employee_document`.
- Uploads antigos feitos por colaboradores passam a **pendentes** (aparecem na fila para revisão);
  o mais recente de cada tipo carregado pela empresa passa a "atual".
- Colaborador só apaga o que enviou e ainda está pendente.
- Storage: bucket `employee-files` já existente; recibos ficam em `<employeeId>/payslips/`.

## App do colaborador (Início e navegação)

A app passou a ter barra de navegação fixa: **Início · Ponto · Pedidos · Documentos · Mais**.
O Início mostra o estado do ponto (hoje/semana + registo manual), alertas (documentos rejeitados,
registos de ponto incompletos, avisos por ler, exame de medicina do trabalho a vencer…), avisos,
saldo de férias, próxima ausência e próximo feriado. "Pedidos" é a antiga página de férias e
ausências, agora com filtro Pendentes/Próximos/Passados. "Mais" tem os dados do colaborador
(IBAN e documento mascarados), medicina do trabalho e suporte.
