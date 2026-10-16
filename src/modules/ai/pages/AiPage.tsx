import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Eraser, Sparkles, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { AiProactive } from '../components/AiProactive';
import { ProposalCard } from '../components/ProposalCard';
import { useAiChat } from '../hooks/useAiChat';

const SUGGESTIONS = [
  'O que tenho na agenda esta semana?',
  'Marca uma reunião amanhã às 10:00 chamada "Ponto de situação"',
  'Lembra-me na sexta às 9:00 de enviar o relatório',
  'Quantos dias de férias ainda tenho?',
];

/** Realize AI: conversa com o assistente da empresa (a chave do modelo fica no servidor). */
const AiPage: React.FC = () => {
  const { user } = useWorkspace();
  const { messages, busy, error, send, stop, clear, confirm, cancel } = useAiChat();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const submit = () => {
    if (!draft.trim() || busy) return;
    void send(draft);
    setDraft('');
  };

  return (
    <WorkspacePage>
      <div className="mx-auto flex h-[calc(100dvh-9rem)] max-w-3xl flex-col md:h-[calc(100dvh-7rem)]">
        <header className="mb-3 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h1 className="text-[22px] font-extrabold leading-tight">Realize AI</h1>
            <p className="text-[13px] text-rz-muted">O assistente da empresa</p>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-semibold text-rz-muted ring-1 ring-rz-line hover:text-rz-ink"
            >
              <Eraser className="h-4 w-4" /> Nova conversa
            </button>
          )}
        </header>
        <AiProactive />

        <div className="rz-scroll min-h-0 flex-1 space-y-3 overflow-y-auto rounded-[24px] bg-white p-4 ring-1 ring-rz-line">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <p className="text-[15px] font-semibold">
                Olá, {user.name.split(' ')[0]}! Em que posso ajudar?
              </p>
              <div className="flex max-w-md flex-col gap-2">
                {SUGGESTIONS.map(text => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => void send(text)}
                    className="rounded-2xl bg-rz-canvas px-4 py-2.5 text-left text-[13.5px] hover:bg-rz-primary-soft"
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message, index) => {
            const mine = message.role === 'user';
            return (
              <div key={index}>
                <div className={cn('flex items-end gap-2', mine && 'flex-row-reverse')}>
                  {mine ? (
                    <UserAvatar name={user.name} userId={user.userId} size="xs" />
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <p
                    className={cn(
                      'max-w-[85%] whitespace-pre-wrap break-words rounded-[20px] px-4 py-2.5 text-[14.5px] leading-relaxed',
                      mine
                        ? 'rounded-br-md bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
                        : 'rounded-bl-md bg-rz-canvas'
                    )}
                  >
                    {message.content}
                  </p>
                </div>
                {message.proposals?.map(proposal => (
                  <div key={proposal.id} className="ml-9">
                    <ProposalCard proposal={proposal} onConfirm={confirm} onCancel={cancel} />
                  </div>
                ))}
              </div>
            );
          })}
          {busy && (
            <div className="flex items-end gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span
                className="inline-flex gap-1 rounded-[20px] rounded-bl-md bg-rz-canvas px-4 py-3.5"
                aria-label="A pensar"
              >
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rz-muted" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rz-muted [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rz-muted [animation-delay:240ms]" />
              </span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {error && (
          <p
            role="alert"
            className="mt-2 rounded-2xl bg-rose-50 px-4 py-2 text-[13px] text-rose-700"
          >
            {error}
          </p>
        )}
        <form
          onSubmit={event => {
            event.preventDefault();
            submit();
          }}
          className="mt-3 flex items-end gap-2 rounded-[24px] bg-white p-2 ring-1 ring-rz-line focus-within:ring-rz-primary/40"
        >
          <textarea
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={8000}
            placeholder="Escreva a sua pergunta…"
            aria-label="Pergunta ao Realize AI"
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[14.5px] outline-none"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Parar"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rz-ink text-white"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Enviar"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rz-primary text-white disabled:opacity-40"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          )}
        </form>
      </div>
    </WorkspacePage>
  );
};

export default AiPage;
