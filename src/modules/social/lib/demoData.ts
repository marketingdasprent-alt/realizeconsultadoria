// Feed, comunicados e apreciações de exemplo (só na pré-visualização /dev/realize-2).
import type { Appreciation, FeedComment, FeedPost, Notice } from '../types';

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString();

export const DEMO_NOTICES: Notice[] = [
  {
    id: 'n1',
    title: 'Novo horário de verão',
    message:
      'A partir de segunda-feira o escritório abre às 8h00 e fecha às 17h00. Obrigado pela colaboração.',
    createdAt: minutesAgo(60 * 3),
    read: false,
  },
  {
    id: 'n2',
    title: 'Medicina do trabalho',
    message:
      'As consultas de medicina do trabalho decorrem na próxima semana. Confirme a sua hora.',
    createdAt: minutesAgo(60 * 50),
    read: true,
  },
];

export const DEMO_POSTS: FeedPost[] = [
  {
    id: 'p1',
    authorId: 'marta',
    authorName: 'Marta Lopes',
    authorRole: 'Diretora · Direção',
    isMine: false,
    body: 'Parabéns a toda a equipa pelo fecho do trimestre! 🎉 Superámos o objetivo em 12%. #resultados #equipa',
    audience: 'company',
    department: null,
    attachments: [],
    createdAt: minutesAgo(45),
    editedAt: null,
    commentCount: 2,
    reactions: [
      { emoji: '🎉', count: 9, mine: true },
      { emoji: '👏', count: 4, mine: false },
    ],
  },
  {
    id: 'p2',
    authorId: 'rui',
    authorName: 'Rui Costa',
    authorRole: 'Coordenador · Operações',
    isMine: false,
    body: 'Lembrete: a formação de segurança rodoviária é quinta-feira às 10h, na sala 2. #formacao',
    audience: 'department',
    department: 'Operações',
    attachments: [],
    createdAt: minutesAgo(60 * 6),
    editedAt: null,
    commentCount: 0,
    reactions: [{ emoji: '👍', count: 3, mine: false }],
  },
];

export const DEMO_COMMENTS: Record<string, FeedComment[]> = {
  p1: [
    {
      id: 'c1',
      postId: 'p1',
      authorId: 'ana',
      authorName: 'Ana Ferreira',
      isMine: false,
      body: 'Grande trabalho, equipa! 👏',
      createdAt: minutesAgo(30),
    },
    {
      id: 'c2',
      postId: 'p1',
      authorId: 'joao',
      authorName: 'João Martins',
      isMine: false,
      body: 'Vamos a isso no próximo trimestre!',
      createdAt: minutesAgo(20),
    },
  ],
};

export const DEMO_APPRECIATIONS: Appreciation[] = [
  {
    id: 'ap1',
    kind: 'helpful',
    senderId: 'ana',
    senderName: 'Ana Ferreira',
    recipientId: 'me',
    recipientName: 'Joana Silva',
    message: 'Obrigada pela ajuda com os mapas de férias!',
    isPublic: true,
    createdAt: minutesAgo(60 * 2),
  },
  {
    id: 'ap2',
    kind: 'leadership',
    senderId: 'marta',
    senderName: 'Marta Lopes',
    recipientId: 'rui',
    recipientName: 'Rui Costa',
    message: 'A organização da equipa de Lisboa tem sido exemplar.',
    isPublic: true,
    createdAt: minutesAgo(60 * 20),
  },
  {
    id: 'ap3',
    kind: 'team_spirit',
    senderId: 'joao',
    senderName: 'João Martins',
    recipientId: 'me',
    recipientName: 'Joana Silva',
    message: null,
    isPublic: true,
    createdAt: minutesAgo(60 * 72),
  },
];
