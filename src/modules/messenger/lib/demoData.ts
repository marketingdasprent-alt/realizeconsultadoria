// Dados de exemplo, só para a pré-visualização de desenvolvimento (/dev/realize-2).
// Pessoas fictícias; nada disto é gravado.
import type { ChatMessage, ConversationSummary, DirectoryPerson } from '../types';

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString();

export const DEMO_ME = { userId: 'me', name: 'Joana Silva' };

const PEOPLE: Omit<DirectoryPerson, 'email'>[] = [
  {
    userId: 'ana',
    employeeId: 'e1',
    name: 'Ana Ferreira',
    position: 'Técnica de RH',
    department: 'Recursos Humanos',
  },
  {
    userId: 'joao',
    employeeId: 'e2',
    name: 'João Martins',
    position: 'Comercial',
    department: 'Vendas',
  },
  {
    userId: 'rui',
    employeeId: 'e3',
    name: 'Rui Costa',
    position: 'Coordenador',
    department: 'Operações',
  },
  {
    userId: 'marta',
    employeeId: 'e4',
    name: 'Marta Lopes',
    position: 'Diretora',
    department: 'Direção',
  },
  {
    userId: 'ines',
    employeeId: 'e5',
    name: 'Inês Ricardo',
    position: 'Motorista',
    department: 'Operações',
  },
  {
    userId: 'pedro',
    employeeId: 'e6',
    name: 'Pedro Santos',
    position: 'Contabilista',
    department: 'Financeiro',
  },
];

export const DEMO_DIRECTORY: DirectoryPerson[] = PEOPLE.map(person => ({
  ...person,
  email: `${person.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z ]/g, '')
    .replace(' ', '.')}@exemplo.pt`,
}));

export const DEMO_ONLINE = new Set(['ana', 'rui']);

export const DEMO_CONVERSATIONS: ConversationSummary[] = [
  {
    id: 'ai',
    kind: 'ai',
    title: 'Realize AI',
    subtitle: 'Assistente',
    lastMessage: 'Tem 12 dias de férias disponíveis este ano. Quer que prepare um pedido?',
    lastAt: minutesAgo(3),
    unread: 1,
    pinned: true,
    canPost: true,
  },
  {
    id: 'ana',
    kind: 'direct',
    title: 'Ana Ferreira',
    subtitle: 'Técnica de RH · Recursos Humanos',
    lastMessage: 'Perfeito, já aprovei o pedido 🙂',
    lastAt: minutesAgo(9),
    unread: 2,
    peerUserId: 'ana',
    canPost: true,
  },
  {
    id: 'operacoes',
    kind: 'group',
    title: 'Operações Lisboa',
    subtitle: '8 membros',
    lastAuthor: 'Rui',
    lastMessage: 'Reunião às 15h na sala 2',
    lastAt: minutesAgo(48),
    unread: 0,
    memberCount: 8,
    canPost: true,
  },
  {
    id: 'geral',
    kind: 'channel',
    title: 'Geral',
    subtitle: '36 membros',
    lastAuthor: 'Marta',
    lastMessage: 'Bom dia a todos! ☀️',
    lastAt: minutesAgo(130),
    unread: 5,
    memberCount: 36,
    canPost: true,
  },
  {
    id: 'comunicados',
    kind: 'announcement',
    title: 'Comunicados',
    subtitle: 'Só leitura',
    lastMessage: 'Novo horário de verão a partir de segunda-feira',
    lastAt: minutesAgo(60 * 26),
    unread: 0,
    muted: true,
    canPost: false,
  },
  {
    id: 'joao',
    kind: 'direct',
    title: 'João Martins',
    subtitle: 'Comercial · Vendas',
    lastMessage: 'Envio-te o relatório amanhã de manhã',
    lastAt: minutesAgo(60 * 50),
    unread: 0,
    peerUserId: 'joao',
    canPost: true,
  },
];

const message = (
  id: string,
  conversationId: string,
  senderId: string,
  minutes: number,
  extra: Partial<ChatMessage>
): ChatMessage => ({
  id,
  conversationId,
  senderId,
  authorName:
    senderId === DEMO_ME.userId
      ? 'Eu'
      : (DEMO_DIRECTORY.find(p => p.userId === senderId)?.name ?? 'Realize AI'),
  isMine: senderId === DEMO_ME.userId,
  kind: 'text',
  createdAt: minutesAgo(minutes),
  reactions: [],
  ...extra,
});

export const DEMO_MESSAGES: Record<string, ChatMessage[]> = {
  ana: [
    message('a1', 'ana', 'ana', 60 * 25, { text: 'Olá! Vi o teu pedido de férias para agosto.' }),
    message('a2', 'ana', 'me', 60 * 24, {
      text: 'Olá Ana! Sim, de 4 a 15. Está tudo bem com as datas?',
      read: true,
    }),
    message('a3', 'ana', 'ana', 14, {
      kind: 'file',
      attachment: {
        path: '',
        name: 'Mapa de férias 2026.pdf',
        size: 290_816,
        mime: 'application/pdf',
      },
    }),
    message('a4', 'ana', 'ana', 9, {
      text: 'Perfeito, já aprovei o pedido 🙂',
      replyTo: {
        id: 'a2',
        authorName: 'Eu',
        text: 'Olá Ana! Sim, de 4 a 15. Está tudo bem com as datas?',
      },
      reactions: [{ emoji: '🎉', count: 1, mine: true }],
    }),
  ],
  ai: [
    message('ai1', 'ai', 'me', 4, { text: 'Quantos dias de férias ainda tenho?', read: true }),
    message('ai2', 'ai', 'ai', 3, {
      text: 'Tem 12 dias de férias disponíveis este ano. Quer que prepare um pedido?',
    }),
  ],
  operacoes: [
    message('o1', 'operacoes', 'rui', 52, { kind: 'audio', durationSec: 34 }),
    message('o2', 'operacoes', 'rui', 48, { text: 'Reunião às 15h na sala 2' }),
  ],
};
