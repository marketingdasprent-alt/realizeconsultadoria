import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUp, Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/modules/workspace/components/ConfirmDialog';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { AppreciationCard } from '../components/AppreciationCard';
import { FeedSidebar } from '../components/feed/FeedSidebar';
import { NoticeCard } from '../components/feed/NoticeCard';
import { PostCard } from '../components/feed/PostCard';
import { PostComposer } from '../components/feed/PostComposer';
import { useAppreciations } from '../hooks/useAppreciations';
import { useFeedPosts } from '../hooks/useFeedPosts';
import { useFeedUnread } from '../hooks/useFeedUnread';
import { useProtectImages } from '../hooks/useProtectImages';
import { useFeedRealtime } from '../hooks/useFeedRealtime';
import { useNotices } from '../hooks/useNotices';
import { buildTimeline, FEED_FILTERS, topHashtags, type FeedFilter } from '../lib/timeline';
import type { FeedPost } from '../types';

/** Feed da organização (briefing §12): publicações, comunicados dos RH e reconhecimentos. */
const FeedPage: React.FC = () => {
  const feed = useFeedPosts();
  const { markSeen } = useFeedUnread();
  useProtectImages();
  const { notices, confirmRead, isLoading: noticesLoading } = useNotices();
  const recognitions = useAppreciations('public');
  const realtime = useFeedRealtime();
  const [params] = useSearchParams();
  const focusId = params.get('post');
  // /colaborador/avisos redireciona para aqui com ?filtro=comunicados.
  const [filter, setFilter] = useState<FeedFilter>(
    params.get('filtro') === 'comunicados' ? 'notices' : 'all'
  );
  const [query, setQuery] = useState('');
  const [hashtag, setHashtag] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<FeedPost | null>(null);

  const timeline = useMemo(
    () =>
      buildTimeline({
        posts: feed.posts,
        notices,
        recognitions: recognitions.items,
        filter,
        query,
        hashtag,
      }),
    [feed.posts, notices, recognitions.items, filter, query, hashtag]
  );

  // Está a ver o Feed: o que há de novo conta como visto.
  useEffect(() => {
    if (!feed.isLoading) markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o Feed carrega ou muda
  }, [feed.isLoading, feed.posts.length]);

  // Aberta a partir de uma notificação: leva até à publicação.
  useEffect(() => {
    if (focusId)
      document
        .getElementById(`post-${focusId}`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusId, feed.posts.length]);

  const isLoading = feed.isLoading || noticesLoading;

  return (
    <WorkspacePage>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[26px] font-extrabold">Feed</h1>
            <label className="flex h-10 w-full items-center gap-2 rounded-full bg-white px-4 text-rz-muted ring-1 ring-rz-line focus-within:ring-rz-primary/40 sm:w-72">
              <Search className="h-4 w-4" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Pesquisar no Feed"
                className="w-full bg-transparent text-sm text-rz-ink outline-none"
              />
            </label>
          </div>
          <PostComposer onPublish={feed.publish} isPublishing={feed.isPublishing} />
          <div className="scrollbar-hide flex gap-2 overflow-x-auto">
            {FEED_FILTERS.map(option => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key)}
                className={cn(
                  'shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors',
                  filter === option.key
                    ? 'bg-rz-ink text-white'
                    : 'bg-white text-rz-muted ring-1 ring-rz-line'
                )}
              >
                {option.label}
              </button>
            ))}
            {hashtag && (
              <button
                type="button"
                onClick={() => setHashtag(null)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rz-primary-soft px-4 py-2 text-[13px] font-semibold text-rz-primary"
              >
                #{hashtag} <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {realtime.hasNewPosts && (
            <button
              type="button"
              onClick={realtime.showNewPosts}
              className="mx-auto flex items-center gap-2 rounded-full bg-rz-primary px-4 py-2 text-sm font-semibold text-white shadow-rz-pop"
            >
              <ArrowUp className="h-4 w-4" /> Novas publicações
            </button>
          )}

          {isLoading ? (
            <Loader2 className="mx-auto mt-10 h-7 w-7 animate-spin text-rz-primary" />
          ) : timeline.length === 0 ? (
            <p className="rounded-[28px] bg-white p-10 text-center text-rz-muted ring-1 ring-rz-line">
              Nada para mostrar. Que tal partilhar a primeira novidade?
            </p>
          ) : (
            timeline.map(item =>
              item.type === 'post' ? (
                <PostCard
                  key={`p-${item.post.id}`}
                  post={item.post}
                  onReact={feed.toggleReaction}
                  onDelete={setToDelete}
                  onHashtag={setHashtag}
                  isFocused={item.post.id === focusId}
                />
              ) : item.type === 'notice' ? (
                <NoticeCard
                  key={`n-${item.notice.id}`}
                  notice={item.notice}
                  onConfirm={n => confirmRead([n.id])}
                />
              ) : (
                <AppreciationCard
                  key={`a-${item.appreciation.id}`}
                  appreciation={item.appreciation}
                  variant="feed"
                />
              )
            )
          )}
          {feed.hasMore && (filter === 'all' || filter === 'posts') && (
            <button
              type="button"
              onClick={feed.loadMore}
              className="mx-auto block rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-rz-primary ring-1 ring-rz-line"
            >
              Ver publicações anteriores
            </button>
          )}
        </div>
        <FeedSidebar
          notices={notices}
          hashtags={topHashtags(feed.posts)}
          recognitions={recognitions.items}
          onShowNotices={() => setFilter('notices')}
          onHashtag={setHashtag}
        />
      </div>
      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar publicação?"
        description="A publicação, os anexos e os comentários deixam de estar visíveis para todos."
        confirmLabel="Eliminar"
        onConfirm={() => toDelete && feed.remove(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </WorkspacePage>
  );
};

export default FeedPage;
