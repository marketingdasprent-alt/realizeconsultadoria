// Notificações de exemplo (só na pré-visualização /dev/realize-2).
import type { NotificationRow } from '../services/notificationService';

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString();

const base = { user_id: 'me', actor_id: null, read_at: null } as const;

export const DEMO_NOTIFICATIONS: NotificationRow[] = [
  {
    ...base,
    id: 'nt1',
    kind: 'appreciation',
    title: 'Ana reconheceu o seu trabalho',
    body: 'Obrigada pela ajuda com os mapas de férias!',
    link: '/colaborador/apreciacoes',
    created_at: minutesAgo(120),
  },
  {
    ...base,
    id: 'nt2',
    kind: 'absence',
    title: 'Pedido de férias aprovado',
    body: '04/08 a 15/08/2026',
    link: '/colaborador/pedidos',
    created_at: minutesAgo(60 * 5),
  },
  {
    ...base,
    id: 'nt3',
    kind: 'feed_comment',
    title: 'João comentou a sua publicação',
    body: 'Vamos a isso no próximo trimestre!',
    link: '/colaborador/feed?post=p1',
    created_at: minutesAgo(60 * 26),
    read_at: minutesAgo(60 * 20),
  },
  {
    ...base,
    id: 'nt4',
    kind: 'document',
    title: 'Novo recibo de vencimento',
    body: 'Recibo_setembro_2026.pdf',
    link: '/colaborador/documentos',
    created_at: minutesAgo(60 * 50),
    read_at: minutesAgo(60 * 48),
  },
];
