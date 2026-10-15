import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isToday } from 'date-fns';
import { Bell, BellRing, ChevronRight, Megaphone, MessagesSquare } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NotificationItem } from '@/modules/notifications/components/NotificationItem';
import { useNotifications } from '@/modules/notifications/hooks/useNotifications';
import type { NotificationRow } from '@/modules/notifications/services/notificationService';
import { useWorkspace } from '../../context/workspaceContext';

const SUMMARY =
  'flex w-full items-center gap-3 rounded-2xl bg-rz-canvas px-3 py-2.5 text-left text-[13.5px] font-semibold transition-colors hover:bg-rz-primary-soft';

/** Centro de notificações (briefing §18): o que precisa de atenção, agrupado por data. */
export const NotificationsButton: React.FC = () => {
  const { basePath } = useWorkspace();
  const navigate = useNavigate();
  const center = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const today = center.items.filter(item => isToday(new Date(item.created_at)));
  const earlier = center.items.filter(item => !isToday(new Date(item.created_at)));

  const go = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };
  // Os caminhos gravados na BD são da app real (/colaborador/…).
  const open = (item: NotificationRow) => {
    if (!item.read_at) center.markRead([item.id]);
    if (item.link) go(item.link.replace(/^\/colaborador/, basePath));
  };

  const group = (label: string, items: NotificationRow[]) =>
    items.length > 0 && (
      <div>
        <p className="mb-1 px-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-rz-muted">
          {label}
        </p>
        {items.map(item => (
          <NotificationItem key={item.id} item={item} onOpen={open} />
        ))}
      </div>
    );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rz-glass relative flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20"
          aria-label={`Notificações${center.badge ? ` (${center.badge} por ver)` : ''}`}
        >
          <Bell className="h-[18px] w-[18px]" />
          {center.badge > 0 && (
            <span className="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-rose-500 px-1 text-center text-[11px] font-bold leading-5 text-white ring-2 ring-[hsl(250_64%_20%)]">
              {center.badge > 99 ? '99+' : center.badge}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className="flex max-h-[min(36rem,80vh)] w-[min(24rem,calc(100vw-1.5rem))] flex-col rounded-[28px] border-white/60 p-0 shadow-rz-pop"
      >
        <div className="flex items-center justify-between border-b border-rz-line px-5 py-4">
          <p className="text-[15px] font-bold">Notificações</p>
          {center.unread > 0 && (
            <button
              type="button"
              onClick={center.markAllRead}
              className="text-[12.5px] font-semibold text-rz-primary"
            >
              Marcar tudo como lido
            </button>
          )}
        </div>
        <div className="rz-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-2.5">
          {(center.messagesUnread > 0 || center.noticesUnread > 0) && (
            <div className="space-y-1.5">
              {center.messagesUnread > 0 && (
                <button type="button" className={SUMMARY} onClick={() => go(basePath)}>
                  <MessagesSquare className="h-4 w-4 text-rz-primary" />
                  <span className="flex-1">
                    {center.messagesUnread}{' '}
                    {center.messagesUnread === 1 ? 'mensagem por ler' : 'mensagens por ler'}
                  </span>
                  <ChevronRight className="h-4 w-4 text-rz-muted" />
                </button>
              )}
              {center.noticesUnread > 0 && (
                <button
                  type="button"
                  className={SUMMARY}
                  onClick={() => go(`${basePath}/feed?filtro=comunicados`)}
                >
                  <Megaphone className="h-4 w-4 text-amber-500" />
                  <span className="flex-1">
                    {center.noticesUnread}{' '}
                    {center.noticesUnread === 1
                      ? 'comunicado por confirmar'
                      : 'comunicados por confirmar'}
                  </span>
                  <ChevronRight className="h-4 w-4 text-rz-muted" />
                </button>
              )}
            </div>
          )}
          {group('Hoje', today)}
          {group('Anteriores', earlier)}
          {center.items.length === 0 && center.badge === 0 && (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-violet-100 to-amber-100">
                <BellRing className="h-7 w-7 text-rz-primary" />
              </span>
              <p className="font-semibold">Está tudo em dia</p>
              <p className="mt-1 text-sm text-rz-muted">
                Apreciações, comentários e pedidos aparecem aqui.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
