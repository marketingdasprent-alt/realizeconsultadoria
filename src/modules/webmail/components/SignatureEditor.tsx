import React, { useEffect, useRef, useState } from 'react';
import { Code2, ImagePlus, PenLine } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { sanitizeSignatureHtml, signatureToHtml } from '../lib/signature';
import {
  caretRangeAt,
  dragHasFiles,
  imageFilesOf,
  defaultSignatureWidth,
  isHeavyGif,
  naturalWidthOf,
  prepareSignatureImage,
} from '../lib/signatureEditing';
import { uploadSignatureImage } from '../services/signatureService';
import { SignatureImagePanel } from './SignatureImagePanel';
import { SignatureToolbar } from './SignatureToolbar';

interface SignatureEditorProps {
  /** Assinatura guardada (HTML, ou texto das assinaturas antigas). */
  initial: string | null;
  onChange: (html: string) => void;
}

/**
 * Assinatura: modo visual (texto formatado, listas, cores, links e imagens que se arrastam ou
 * colam) ou código HTML com pré-visualização.
 */
export const SignatureEditor: React.FC<SignatureEditorProps> = ({ initial, onChange }) => {
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const [html, setHtml] = useState(() => signatureToHtml(initial));
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
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
    saveRange();
  };

  /** Envia as imagens (reduzidas se grandes) e põe-nas onde está o cursor, uma a seguir à outra. */
  const addImages = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    for (const original of files) {
      const prepared = await prepareSignatureImage(original);
      if (isHeavyGif(original)) {
        const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
        toast(
          prepared.size < original.size
            ? {
                title: 'GIF comprimido',
                description: `De ${mb(original.size)} para ${mb(prepared.size)}, com a animação.`,
              }
            : {
                title: 'GIF pesado',
                description: `Tem ${mb(original.size)}: pode demorar a abrir nalguns emails.`,
              }
        );
      }
      const { url, error } = await uploadSignatureImage(prepared);
      if (!url) {
        toast({ title: error ?? 'A imagem não foi enviada', variant: 'destructive' });
        continue;
      }
      const width = defaultSignatureWidth((await naturalWidthOf(prepared)) || 320);
      command(
        'insertHTML',
        `<img src="${url}" width="${width}" style="width:${width}px;max-width:100%;height:auto" alt="">`
      );
    }
    setUploading(false);
  };

  const onDrop = (event: React.DragEvent) => {
    if (!dragHasFiles(event.dataTransfer)) return; // arrastar dentro do editor: o navegador trata
    event.preventDefault();
    setDragging(false);
    const files = imageFilesOf(event.dataTransfer.files);
    if (!files.length) return void toast({ title: 'Só se podem largar imagens aqui.' });
    // A imagem fica onde se largou.
    const target = caretRangeAt(event.clientX, event.clientY);
    if (target && editor.current?.contains(target.startContainer)) range.current = target;
    void addImages(files);
  };

  const onPaste = (event: React.ClipboardEvent) => {
    const files = imageFilesOf(event.clipboardData.files);
    if (files.length) {
      event.preventDefault();
      return void addImages(files);
    }
    // Colar do Outlook/Word/site: fica a formatação, sem o lixo nem o que é perigoso.
    const pasted = event.clipboardData.getData('text/html');
    if (pasted) {
      event.preventDefault();
      command('insertHTML', sanitizeSignatureHtml(pasted));
    }
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
          <SignatureToolbar
            uploading={uploading}
            onCommand={command}
            onLink={() => (saveRange(), setLinkDraft(''))}
            onImage={() => (saveRange(), fileInput.current?.click())}
          />
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
          className="relative"
          onDragOver={event => {
            if (!dragHasFiles(event.dataTransfer)) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              setDragging(false);
          }}
          onDrop={onDrop}
        >
          <div
            ref={editor}
            contentEditable
            suppressContentEditableWarning
            onInput={fromEditor}
            onKeyUp={saveRange}
            onMouseUp={saveRange}
            onBlur={saveRange}
            onPaste={onPaste}
            onClick={event =>
              setImage(event.target instanceof HTMLImageElement ? event.target : null)
            }
            className="min-h-[300px] resize-y overflow-auto rounded-2xl bg-white px-4 py-3 text-[14px] leading-relaxed outline-none ring-1 ring-rz-line focus:ring-rz-primary/40 [&_a]:text-rz-primary [&_a]:underline [&_img]:inline-block [&_img]:cursor-pointer [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
            aria-label="Assinatura"
          />
          {dragging && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl bg-rz-primary-soft/90 text-[14px] font-bold text-rz-primary ring-2 ring-rz-primary">
              <ImagePlus className="h-7 w-7" /> Largue a imagem aqui
            </div>
          )}
        </div>
      ) : (
        <>
          <textarea
            value={html}
            onChange={event => update(event.target.value)}
            rows={9}
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

      {mode === 'visual' && (
        <p className="px-1 text-[12px] text-rz-muted">
          Arraste imagens para o texto ou cole-as (Ctrl+V). Clique numa imagem para mudar o tamanho
          ou pôr um link. Pode colar a assinatura do Outlook com a formatação.
        </p>
      )}
      {mode === 'visual' && image && editor.current?.contains(image) && (
        <SignatureImagePanel image={image} onChange={fromEditor} onDone={() => setImage(null)} />
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={event => {
          void addImages(imageFilesOf(event.target.files));
          event.target.value = '';
        }}
      />
    </div>
  );
};
