import React from 'react';
import { Link } from 'react-router-dom';
import { Award, Hash, Megaphone } from 'lucide-react';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import type { Appreciation, Notice } from '../../types';

interface FeedSidebarProps {
  notices: Notice[];
  hashtags: [string, number][];
  recognitions: Appreciation[];
  onShowNotices: () => void;
  onHashtag: (tag: string) => void;
}

const CARD = 'rounded-[28px] bg-white p-5 shadow-rz-soft ring-1 ring-rz-line';

/** Coluna lateral do Feed: comunicados por confirmar, temas do momento e reconhecimentos. */
export const FeedSidebar: React.FC<FeedSidebarProps> = ({
  notices,
  hashtags,
  recognitions,
  onShowNotices,
  onHashtag,
}) => {
  const { basePath } = useWorkspace();
  const unread = notices.filter(n => !n.read);
  return (
    <aside className="hidden space-y-4 lg:block">
      <section className={CARD}>
        <h2 className="flex items-center gap-2 text-[15px] font-bold">
          <Megaphone className="h-4 w-4 text-amber-500" /> Comunicados
        </h2>
        {unread.length > 0 ? (
          <>
            <ul className="mt-3 space-y-2">
              {unread.slice(0, 3).map(notice => (
                <li
                  key={notice.id}
                  className="rounded-2xl bg-amber-50 px-3 py-2 text-[13.5px] font-semibold"
                >
                  {notice.title}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onShowNotices}
              className="mt-3 text-[13px] font-semibold text-rz-primary"
            >
              Ver e confirmar ({unread.length})
            </button>
          </>
        ) : (
          <p className="mt-2 text-[13.5px] text-rz-muted">Está tudo lido. 👌</p>
        )}
      </section>

      {hashtags.length > 0 && (
        <section className={CARD}>
          <h2 className="flex items-center gap-2 text-[15px] font-bold">
            <Hash className="h-4 w-4 text-rz-primary" /> Temas do momento
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {hashtags.slice(0, 8).map(([tag, count]) => (
              <button
                key={tag}
                type="button"
                onClick={() => onHashtag(tag)}
                className="rounded-full bg-rz-primary-soft px-3 py-1 text-[13px] font-semibold text-rz-primary"
              >
                #{tag} <span className="opacity-60">{count}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={CARD}>
        <h2 className="flex items-center gap-2 text-[15px] font-bold">
          <Award className="h-4 w-4 text-pink-500" /> Reconhecimentos
        </h2>
        <p className="mt-2 text-[13.5px] text-rz-muted">
          {recognitions.length > 0
            ? `${recognitions.length} apreciações públicas recentes na empresa.`
            : 'Ainda ninguém foi reconhecido. Seja o primeiro!'}
        </p>
        <Link
          to={`${basePath}/apreciacoes`}
          className="mt-3 inline-block text-[13px] font-semibold text-rz-primary"
        >
          Enviar uma apreciação →
        </Link>
      </section>
    </aside>
  );
};
