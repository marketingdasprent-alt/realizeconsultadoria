import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { useDirectory } from '../../hooks/useDirectory';
import { groupReactors } from '../../lib/feed';
import { feedService } from '../../services/feedService';

interface PostReactorsProps {
  postId: string;
}

/** "Quem reagiu": lista as pessoas por emoji (carrega só quando se abre). */
export const PostReactors: React.FC<PostReactorsProps> = ({ postId }) => {
  const { isPreview } = useWorkspace();
  const { nameOf } = useDirectory();
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['feed', 'reactors', postId],
    queryFn: async () => {
      const { data: rows, error } = await feedService.listReactors(postId);
      if (error) throw error;
      return rows;
    },
    enabled: open && !isPreview,
  });
  const groups = groupReactors(data ?? []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-full px-2 py-1 text-[12.5px] font-semibold text-rz-muted hover:bg-rz-canvas hover:text-rz-primary"
        >
          Quem reagiu
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 rounded-2xl p-3 shadow-rz-pop">
        {isPreview && (
          <p className="text-[13px] text-rz-muted">Indisponível na pré-visualização.</p>
        )}
        {isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-rz-primary" />}
        {isError && <p className="text-[13px] text-rose-600">Não foi possível carregar.</p>}
        <div className="max-h-72 space-y-3 overflow-y-auto">
          {groups.map(group => (
            <section key={group.emoji}>
              <p className="mb-1 text-[13px] font-bold">
                {group.emoji} {group.userIds.length}
              </p>
              <ul className="space-y-1">
                {group.userIds.map(userId => (
                  <li key={userId} className="flex items-center gap-2 text-[13.5px]">
                    <UserAvatar name={nameOf(userId)} userId={userId} size="sm" />
                    <span className="truncate">{nameOf(userId)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
