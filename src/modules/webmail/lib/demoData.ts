// Caixas e emails de exemplo para a pré-visualização (em memória).
import type { MailAccount, MailFolder, MailMessage } from '../types';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const DEMO_MAIL_ACCOUNTS: MailAccount[] = [
  {
    id: 'work',
    provider: 'office365',
    authMethod: 'oauth-microsoft',
    email: 'joana.silva@exemplo.pt',
    displayName: 'Joana Silva',
    signatures: [
      {
        id: 'demo-sig-1',
        name: 'Completa',
        html: 'Joana Silva<br>Gestora de Operações · Realize Consultadoria',
        isDefault: true,
      },
      { id: 'demo-sig-2', name: 'Curta', html: 'Joana', isDefault: false },
    ],
    status: 'active',
    lastError: null,
    lastSyncAt: minutesAgo(2),
    isDefault: true,
    color: 'violet',
    shared: false,
    notify: true,
    label: null,
  },
  {
    id: 'gmail',
    provider: 'gmail',
    authMethod: 'oauth-google',
    email: 'joana.silva.pt@gmail.com',
    displayName: 'Joana Silva',
    signatures: [],
    status: 'active',
    lastError: null,
    lastSyncAt: minutesAgo(5),
    isDefault: false,
    color: 'rose',
    shared: false,
    notify: true,
    label: null,
  },
];

interface DemoMail extends MailMessage {
  folder: MailFolder;
}

const mail = (
  id: string,
  accountId: string,
  folder: MailFolder,
  minutes: number,
  from: [string, string],
  subject: string,
  text: string,
  extra: Partial<DemoMail> = {}
): DemoMail => ({
  id,
  accountId,
  folder,
  threadId: id,
  from: { name: from[0], email: from[1] },
  to: [{ name: 'Joana Silva', email: DEMO_MAIL_ACCOUNTS[accountId === 'work' ? 0 : 1].email }],
  cc: [],
  replyTo: [],
  subject,
  snippet: text.replace(/\s+/g, ' ').slice(0, 140),
  date: minutesAgo(minutes),
  unread: false,
  starred: false,
  hasAttachments: false,
  html: null,
  text,
  attachments: [],
  ...extra,
});

export const DEMO_MAILS: DemoMail[] = [
  mail(
    'm1',
    'work',
    'inbox',
    12,
    ['Ana Ferreira', 'ana.ferreira@exemplo.pt'],
    'Plano de férias de verão — confirmação',
    'Olá Joana,\n\nJá aprovei o teu pedido de férias de 4 a 15 de agosto. Confirma só se a passagem de turno com o Rui está combinada.\n\nObrigada!\nAna',
    { unread: true }
  ),
  mail(
    'm2',
    'work',
    'inbox',
    55,
    ['Marta Lopes', 'marta.lopes@exemplo.pt'],
    'Reunião de resultados do trimestre',
    'Bom dia a todos,\n\nA reunião de resultados fica marcada para quinta às 15h, na sala 2. Tragam os números da vossa equipa.\n\nMarta',
    {
      unread: true,
      starred: true,
      hasAttachments: true,
      cc: [{ name: 'Rui Costa', email: 'rui.costa@exemplo.pt' }],
      attachments: [
        { id: 'a1', filename: 'Resultados-T3.pdf', mime: 'application/pdf', size: 482_133 },
      ],
      html: '<p>Bom dia a todos,</p><p>A reunião de resultados fica marcada para <b>quinta às 15h</b>, na sala 2. Tragam os números da vossa equipa.</p><p>Marta</p>',
    }
  ),
  mail(
    'm3',
    'gmail',
    'inbox',
    90,
    ['CP – Comboios de Portugal', 'noreply@exemplo-cp.pt'],
    'O seu bilhete Lisboa → Porto',
    'Obrigado pela sua compra. Viagem a 22 de outubro, partida 08:39, carruagem 4, lugar 52.',
    { unread: true }
  ),
  mail(
    'm4',
    'work',
    'inbox',
    60 * 5,
    ['João Martins', 'joao.martins@exemplo.pt'],
    'Proposta para o cliente Atlântico',
    'Joana, envio em anexo a proposta revista. Consegues dar uma vista de olhos até amanhã?\n\nAbraço,\nJoão',
    {
      hasAttachments: true,
      attachments: [
        {
          id: 'a2',
          filename: 'Proposta-Atlantico-v3.docx',
          mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 88_210,
        },
      ],
    }
  ),
  mail(
    'm5',
    'work',
    'inbox',
    60 * 26,
    ['Recursos Humanos', 'rh@exemplo.pt'],
    'Recibo de vencimento de setembro disponível',
    'O seu recibo de vencimento de setembro já está disponível na área de Documentos do Realize.'
  ),
  mail(
    'm6',
    'gmail',
    'inbox',
    60 * 30,
    ['Pedro Santos', 'pedro.santos.pt@gmail.com'],
    'Jantar de equipa 🍝',
    'Pessoal, que tal sexta-feira dia 24 no Tasca do Bairro? Respondam até quarta!'
  ),
  mail(
    'm7',
    'work',
    'sent',
    60 * 3,
    ['Joana Silva', 'joana.silva@exemplo.pt'],
    'Re: Escala de novembro',
    'Rui, a escala está fechada. Ficas com os sábados 8 e 22.\n\nJoana',
    { to: [{ name: 'Rui Costa', email: 'rui.costa@exemplo.pt' }] }
  ),
  mail(
    'm8',
    'work',
    'archive',
    60 * 24 * 9,
    ['Inês Ricardo', 'ines.ricardo@exemplo.pt'],
    'Manutenção da viatura 23-AB-45',
    'A viatura fica na oficina de segunda a quarta. Já reorganizei as rotas.'
  ),
];
