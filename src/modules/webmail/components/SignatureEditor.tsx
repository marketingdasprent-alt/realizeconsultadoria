import React, { useEffect, useRef, useState } from 'react';
import { Bold, Code2, ImagePlus, Italic, Link2, Loader2, PenLine } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { sanitizeSignatureHtml, signatureToHtml } from '../lib/signature';
import { uploadSignatureImage } from '../services/signatureService';
import { SignatureImagePanel } from './SignatureImagePanel';

interface SignatureEditorProps {
  /** Assinatura guardada (HTML, ou texto das assinaturas antigas). */
  initial: string | null;
  onChange: (html: string) => void;
}

const TOOL =
  'inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold text-rz-muted hover:bg-white hover:text-rz-ink';

/** Assinatura: modo visual (texto, links, imagens com link) ou código HTML com pré-visualização. */
export const SignatureEditor: React.FC<SignatureEditorProps> = ({ initial, onChange }) => {
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const [html, setHtml] = useState(() => signatureToHtml(initial));
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const range = useRef<Range | null>(null);

  // O editor visual não é controlado pelo React: recebe o HTML ao abrir e ao voltar do código.
  useEffect(() => {
    if (mode === 'visual' && editor.current) editor.current.innerHTML = html;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao mudar de modo
  }, [mode]);

  const update = (next: string) => {
    setHtml(next);
    onChange(next);
  };
  const fromEditor = () => update(editor.current?.innerHTML ?? '');
  const saveRange = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editor.current?.contains(selection.anchorNode))
      range.current = selection.getRangeAt(0).cloneRange();
  };
  const restoreRange = () => {
    editor.current?.focus();
    const selection = window.getSelection();
    if (range.current && selection) {
      selection.removeAllRanges();
      selection.addRange(range.current);
    }
  };
  const command = (name: string, value?: string) => {
    restoreRange();
    document.execCommand(name, false, value);
    fromEditor();
  };

  const addImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const { url, error } = await uploadSignatureImage(file);
    setUploading(false);
    if (!url) return void toast({ title: error ?? 'Erro', variant: 'destructive' });
    command('insertHTML', `<img src="${url}" width="160" alt="">`);
  };

  const switchMode = (next: 'visual' | 'html') => {
    if (next === mode) return;
    if (next === 'visual') update(sanitizeSignatureHtml(html));
    setImage(null);
    setMode(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-0.5 rounded-2xl bg-rz-canvas p-1">
        {mode === 'visual' && (
          <>
            <button
              type="button"
              className={TOOL}
              onMouseDown={e => (e.preventDefault(), command('bold'))}
              aria-label="Negrito"
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={TOOL}
              onMouseDown={e => (e.preventDefault(), command('italic'))}
              aria-label="Itálico"
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={TOOL}
              onMouseDown={e => (e.preventDefault(), saveRange(), setLinkDraft(''))}
            >
              <Link2 className="h-4 w-4" /> Link
            </button>
            <button
              type="button"
              className={TOOL}
              disabled={uploading}
              onMouseDown={e => (e.preventDefault(), saveRange(), fileInput.current?.click())}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}{' '}
              Imagem
            </button>
          </>
        )}
        <div className="ml-auto flex rounded-full bg-white p-0.5 ring-1 ring-rz-line">
          {(['visual', 'html'] as const).map(option => (
            <button
              key={option}
              type="button"
              onClick={() => switchMode(option)}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold',
                mode === option ? 'bg-rz-ink text-white' : 'text-rz-muted'
              )}
            >
              {option === 'visual' ? (
                <PenLine className="h-3.5 w-3.5" />
              ) : (
                <Code2 className="h-3.5 w-3.5" />
              )}
              {option === 'visual' ? 'Visual' : 'HTML'}
            </button>
          ))}
        </div>
      </div>

      {linkDraft !== null && (
        <form
          onSubmit={event => {
            event.preventDefault();
            const url = linkDraft.trim();
            if (url)
              command('createLink', /^(https?:|mailto:|tel:)/i.test(url) ? url : `https://${url}`);
            setLinkDraft(null);
          }}
          className="flex gap-2"
        >
          <input
            autoFocus
            value={linkDraft}
            onChange={event => setLinkDraft(event.target.value)}
            placeholder="Endereço do link (selecione antes o texto)"
            className="h-9 flex-1 rounded-xl bg-white px-3 text-[13px] outline-none ring-1 ring-rz-line focus:ring-rz-primary/40"
          />
          <button
            type="submit"
            className="rounded-full bg-rz-primary px-4 text-[13px] font-bold text-white"
          >
            Pôr link
          </button>
        </form>
      )}

      {mode === 'visual' ? (
        <div
          ref={editor}
          contentEditable
          suppressContentEditableWarning
          onInput={fromEditor}
          onKeyUp={saveRange}
          onMouseUp={saveRange}
          onClick={event =>
            setImage(event.target instanceof HTMLImageElement ? event.target : null)
          }
          className="min-h-[110px] rounded-2xl bg-white px-4 py-3 text-[14px] leading-relaxed outline-none ring-1 ring-rz-line focus:ring-rz-primary/40 [&_a]:text-rz-primary [&_a]:underline [&_img]:inline-block [&_img]:cursor-pointer"
          aria-label="Assinatura"
        />
      ) : (
        <>
          <textarea
            value={html}
            onChange={event => update(event.target.value)}
            rows={7}
            spellCheck={false}
            placeholder="<table>…</table>"
            className="w-full rounded-2xl bg-white px-4 py-3 font-mono text-[12.5px] outline-none ring-1 ring-rz-line focus:ring-rz-primary/40"
          />
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-rz-muted">
            Pré-visualização
          </p>
          <iframe
            title="Pré-visualização da assinatura"
            sandbox=""
            srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:12px;font-family:Arial,sans-serif;font-size:14px">${sanitizeSignatureHtml(html)}</body>`}
            className="h-44 w-full rounded-2xl bg-white ring-1 ring-rz-line"
          />
        </>
      )}

      {mode === 'visual' && image && editor.current?.contains(image) && (
        <SignatureImagePanel image={image} onChange={fromEditor} onDone={() => setImage(null)} />
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={event => {
          void addImage(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </div>
  );
};
