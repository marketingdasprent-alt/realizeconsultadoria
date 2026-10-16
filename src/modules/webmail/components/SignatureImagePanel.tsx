import React, { useEffect, useState } from 'react';
import { Link2, Trash2 } from 'lucide-react';

const WIDTHS = [
  { value: '80', label: 'Pequena' },
  { value: '160', label: 'Média' },
  { value: '280', label: 'Grande' },
  { value: '', label: 'Original' },
];

interface SignatureImagePanelProps {
  image: HTMLImageElement;
  /** Avisa o editor de que o HTML mudou. */
  onChange: () => void;
  onDone: () => void;
}

/** Imagem escolhida na assinatura: link ao clicar, tamanho e retirar. */
export const SignatureImagePanel: React.FC<SignatureImagePanelProps> = ({
  image,
  onChange,
  onDone,
}) => {
  const anchor =
    image.parentElement?.tagName === 'A' ? (image.parentElement as HTMLAnchorElement) : null;
  const [link, setLink] = useState(anchor?.getAttribute('href') ?? '');

  useEffect(() => setLink(anchor?.getAttribute('href') ?? ''), [anchor]);

  const applyLink = () => {
    const url = link.trim();
    const href = url && !/^(https?:|mailto:|tel:)/i.test(url) ? `https://${url}` : url;
    if (!href && anchor) anchor.replaceWith(image);
    else if (href && anchor) anchor.setAttribute('href', href);
    else if (href) {
      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      image.replaceWith(a);
      a.appendChild(image);
    }
    onChange();
  };

  const setWidth = (value: string) => {
    if (value) image.setAttribute('width', value);
    else image.removeAttribute('width');
    image.removeAttribute('height');
    onChange();
  };

  return (
    <div className="space-y-2 rounded-2xl bg-rz-primary-soft p-3">
      <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-rz-primary">Imagem</p>
      <div className="flex gap-2">
        <span className="flex flex-1 items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-rz-line">
          <Link2 className="h-4 w-4 shrink-0 text-rz-muted" />
          <input
            value={link}
            onChange={event => setLink(event.target.value)}
            onBlur={applyLink}
            onKeyDown={event => event.key === 'Enter' && (event.preventDefault(), applyLink())}
            placeholder="Link ao clicar na imagem (ex.: realizeconsultadoria.pt)"
            className="h-9 flex-1 bg-transparent text-[13px] outline-none"
          />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {WIDTHS.map(width => (
          <button
            key={width.label}
            type="button"
            onClick={() => setWidth(width.value)}
            className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold ring-1 ring-rz-line hover:ring-rz-primary"
          >
            {width.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            (anchor ?? image).remove();
            onChange();
            onDone();
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-semibold text-rose-600 hover:bg-white"
        >
          <Trash2 className="h-3.5 w-3.5" /> Retirar
        </button>
      </div>
    </div>
  );
};
