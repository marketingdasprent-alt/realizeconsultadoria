import React from 'react';
import { Award, MessageCircle, Pencil } from 'lucide-react';
import type { WorkspaceUser } from '../../context/workspaceContext';
import { UserAvatar } from '../UserAvatar';
import { AvatarUploadButton } from './AvatarUploadButton';

interface ProfileHeaderProps {
  user: WorkspaceUser;
  /** Perfil do próprio (editar) ou de um colega (mensagem, apreciação). */
  isOwn: boolean;
  /** Disponível agora (presença); sem valor não mostra o estado. */
  isOnline?: boolean;
  onMessage?: () => void;
  onAppreciate?: () => void;
}

const ACTION =
  'inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors';

/** Capa colorida, avatar, nome, cargo e ações rápidas (briefing §6). */
export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  user,
  isOwn,
  isOnline,
  onMessage,
  onAppreciate,
}) => {
  const details = [user.department, user.companyName].filter(Boolean).join(' · ');
  return (
    <section className="overflow-hidden rounded-[32px] bg-white shadow-rz-soft ring-1 ring-rz-line">
      <div className="relative h-36 bg-gradient-to-br from-violet-500 via-indigo-500 to-sky-400 md:h-44">
        <div
          className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_120%,#fde68a_0,transparent_45%),radial-gradient(circle_at_85%_-10%,#f0abfc_0,transparent_40%)]"
          aria-hidden
        />
      </div>
      <div className="relative px-5 pb-5 md:px-8 md:pb-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="relative -mt-14 w-fit shrink-0">
            <UserAvatar
              name={user.name}
              userId={user.userId}
              size="xl"
              status={isOnline === undefined ? undefined : isOnline ? 'online' : 'offline'}
              className="[&>span:first-child]:ring-4"
            />
            {isOwn && <AvatarUploadButton />}
          </div>
          <div className="min-w-0 flex-1 md:pt-4">
            <h1 className="text-2xl font-extrabold md:text-[28px]">{user.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {user.position && (
                <span className="rounded-full bg-rz-primary-soft px-3 py-1 text-xs font-bold text-rz-primary">
                  {user.position}
                </span>
              )}
              {details && <span className="text-sm text-rz-muted">{details}</span>}
              {isOnline && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Disponível
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:pt-4">
            {isOwn ? (
              <button
                type="button"
                disabled
                className={`${ACTION} bg-rz-canvas text-rz-ink disabled:opacity-60`}
                title="Em breve"
              >
                <Pencil className="h-4 w-4" /> Editar perfil
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onMessage}
                  className={`${ACTION} bg-rz-primary text-white`}
                >
                  <MessageCircle className="h-4 w-4" /> Mensagem
                </button>
                <button
                  type="button"
                  onClick={onAppreciate}
                  className={`${ACTION} bg-rz-canvas text-rz-ink hover:bg-rz-primary-soft`}
                >
                  <Award className="h-4 w-4" /> Apreciar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
