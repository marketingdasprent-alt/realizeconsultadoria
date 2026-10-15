import React, { useRef, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Check, Paperclip, Plus, SendHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/modules/messenger/lib/files';
import { useDirectory } from '@/modules/social/hooks/useDirectory';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import type { useTaskDetail } from '../hooks/useTaskDetail';
import { taskService } from '../services/taskService';
import type { Task } from '../types';

type Detail = ReturnType<typeof useTaskDetail>;

const H = 'mb-2 text-[13px] font-bold uppercase tracking-[0.12em] text-rz-muted';

/** Campo de uma linha para acrescentar (subtarefa, item da lista). */
const AddLine: React.FC<{ placeholder: string; onAdd: (text: string) => void }> = ({
  placeholder,
  onAdd,
}) => {
  const [text, setText] = useState('');
  const add = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText('');
  };
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-rz-canvas px-3">
      <Plus className="h-4 w-4 text-rz-muted" />
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && add()}
        placeholder={placeholder}
        className="h-10 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
};

const Tick: React.FC<{ done: boolean; onClick: () => void; label: string }> = ({
  done,
  onClick,
  label,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className={cn(
      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-2',
      done ? 'bg-emerald-500 text-white ring-emerald-500' : 'ring-rz-line'
    )}
  >
    {done && <Check className="h-3.5 w-3.5 stroke-[3]" />}
  </button>
);

export const SubtasksSection: React.FC<{
  subtasks: Task[];
  onToggle: (task: Task) => void;
  onAdd: (title: string) => void;
  onOpen: (task: Task) => void;
}> = ({ subtasks, onToggle, onAdd, onOpen }) => (
  <section>
    <h4 className={H}>Subtarefas</h4>
    <ul className="mb-2 space-y-1">
      {subtasks.map(sub => (
        <li key={sub.id} className="flex items-center gap-2.5 rounded-xl px-1 py-1">
          <Tick
            done={sub.status === 'done'}
            onClick={() => onToggle(sub)}
            label="Concluir subtarefa"
          />
          <button
            type="button"
            onClick={() => onOpen(sub)}
            className={cn(
              'flex-1 text-left text-[14px]',
              sub.status === 'done' && 'text-rz-muted line-through'
            )}
          >
            {sub.title}
          </button>
        </li>
      ))}
    </ul>
    <AddLine placeholder="Nova subtarefa" onAdd={onAdd} />
  </section>
);

export const ChecklistSection: React.FC<{ detail: Detail }> = ({ detail }) => {
  const done = detail.checklist.filter(i => i.done).length;
  return (
    <section>
      <h4 className={H}>
        Lista de verificação {detail.checklist.length > 0 && `· ${done}/${detail.checklist.length}`}
      </h4>
      {detail.checklist.length > 0 && (
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-rz-canvas">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${(done / detail.checklist.length) * 100}%` }}
          />
        </div>
      )}
      <ul className="mb-2 space-y-1">
        {detail.checklist.map(item => (
          <li key={item.id} className="group flex items-center gap-2.5 px-1 py-1">
            <Tick
              done={item.done}
              onClick={() => detail.toggleChecklistItem(item)}
              label="Marcar item"
            />
            <span className={cn('flex-1 text-[14px]', item.done && 'text-rz-muted line-through')}>
              {item.text}
            </span>
            <button
              type="button"
              onClick={() => detail.removeChecklistItem(item.id)}
              className="opacity-0 group-hover:opacity-100"
              aria-label="Retirar item"
            >
              <Trash2 className="h-3.5 w-3.5 text-rz-muted" />
            </button>
          </li>
        ))}
      </ul>
      <AddLine placeholder="Novo item" onAdd={detail.addChecklistItem} />
    </section>
  );
};

export const AttachmentsSection: React.FC<{ detail: Detail }> = ({ detail }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const open = async (path: string) => {
    const tab = window.open('', '_blank');
    const url = await taskService.getFileUrl(path);
    if (url && tab) tab.location.href = url;
    else tab?.close();
  };
  return (
    <section>
      <h4 className={H}>Anexos</h4>
      <ul className="mb-2 space-y-1">
        {detail.attachments.map(file => (
          <li key={file.id}>
            <button
              type="button"
              onClick={() => open(file.path)}
              className="flex w-full items-center gap-2 rounded-xl bg-rz-canvas px-3 py-2 text-left text-[13px] hover:bg-rz-primary-soft"
            >
              <Paperclip className="h-4 w-4 text-rz-muted" />
              <span className="flex-1 truncate font-semibold">{file.name}</span>
              <span className="text-xs text-rz-muted">{formatBytes(file.size)}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-rz-canvas px-3 text-[13px] font-semibold text-rz-muted hover:text-rz-ink"
      >
        <Paperclip className="h-4 w-4" /> Anexar ficheiro
      </button>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) detail.upload(f);
          e.target.value = '';
        }}
      />
    </section>
  );
};

export const CommentsSection: React.FC<{ detail: Detail }> = ({ detail }) => {
  const { nameOf } = useDirectory();
  const [text, setText] = useState('');
  const send = () => {
    if (!text.trim()) return;
    detail.addComment(text.trim());
    setText('');
  };
  return (
    <section>
      <h4 className={H}>Comentários</h4>
      <ul className="mb-3 space-y-2.5">
        {detail.comments.map(c => (
          <li key={c.id} className="flex gap-2.5">
            <UserAvatar name={nameOf(c.authorId)} userId={c.authorId} size="xs" />
            <div className="min-w-0 flex-1 rounded-2xl bg-rz-canvas px-3.5 py-2">
              <p className="text-[12.5px] font-bold">
                {nameOf(c.authorId)}{' '}
                <span className="font-normal text-rz-muted">
                  ·{' '}
                  {formatDistanceToNowStrict(new Date(c.createdAt), {
                    locale: pt,
                    addSuffix: true,
                  })}
                </span>
              </p>
              <p className="whitespace-pre-wrap text-[14px]">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 rounded-full bg-rz-canvas pr-1">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Escreva um comentário…"
          className="h-10 flex-1 bg-transparent px-4 text-sm outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={!text.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-rz-primary text-white disabled:opacity-30"
          aria-label="Comentar"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
};
