import React, { useEffect, useState } from 'react';
import { Link2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applySignatureWidth, SIGNATURE_MAX_WIDTH } from '../lib/signatureEditing';

// Larguras com que a imagem aparece no email (o ficheiro continua nítido).
const WIDTHS = [
  { value: 150, label: 'Pequena' },
  { value: 300, label: 'Média' },
  { value: 450, label: 'Grande' },
  { value: SIGNATURE_MAX_WIDTH, label: 'Largura do email' },
];

interface SignatureImagePanelProps {
  image: HTMLImageElement;
  /** Avisa o editor de que o HTML mudou. */
  onChange: () => void;
  onDone: () => void;
}

const widthOf = (image: HTMLImageElement) => Number(image.getAttribute('width')) || null;

/** Imagem escolhida na assinatura: link ao clicar, tamanho e retirar. */
export const SignatureImagePanel: React.FC<SignatureImagePanelProps> = ({
  image,
  onChange,
  onDone,
}) => {
  const anchor =
    image.parentElement?.tagName === 'A' ? (image.parentElement as HTMLAnchorElement) : null;
  const [link, setLink] = useState(anchor?.getAttribute('href') ?? '');
  const [width, setWidthState] = useState<number | null>(() => widthOf(image));

  useEffect(() => setLink(anchor?.getAttribute('href') ?? ''), [anchor]);
  useEffect(() => setWidthState(widthOf(image)), [image]);

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

  const setWidth = (value: number | null) => {
    applySignatureWidth(image, value);
    setWidthState(value);
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
        {WIDTHS.map(option => (
          <button
            key={option.label}
            type="button"
            onClick={() => setWidth(option.value)}
            className={cn(
              'rounded-full bg-white px-3 py-1 text-[12px] font-semibold ring-1 hover:ring-rz-primary',
              width === option.value ? 'text-rz-primary ring-rz-primary' : 'ring-rz-line'
            )}
          >
            {option.label}
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
      {/* Afinar à mão: a largura com que aparece no email, em pontos. */}
      <label className="flex items-center gap-3 text-[12px] font-semibold text-rz-muted">
        Largura
        <input
          type="range"
          min={60}
          max={SIGNATURE_MAX_WIDTH}
          step={10}
          value={width ?? SIGNATURE_MAX_WIDTH}
          onChange={event => setWidth(Number(event.target.value))}
          className="flex-1 accent-[hsl(var(--rz-primary))]"
        />
        <span className="w-14 text-right tabular-nums text-rz-ink">
          {width ? `${width} px` : 'real'}
        </span>
      </label>
      <p className="text-[11.5px] leading-snug text-rz-muted">
        A imagem guarda-se com o dobro dos pontos, por isso fica nítida em qualquer tamanho. Nos
        telemóveis encolhe sozinha para caber no ecrã.
      </p>
    </div>
  );
};
