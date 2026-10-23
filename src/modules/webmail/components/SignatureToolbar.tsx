import React from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Eraser,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Palette,
  Redo2,
  Underline,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const TOOL =
  'inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full px-2 text-[12.5px] font-semibold text-rz-muted hover:bg-white hover:text-rz-ink disabled:opacity-40';
const SEP = <span className="mx-1 h-5 w-px bg-rz-line" aria-hidden />;

const SIZES = [
  { label: 'Pequeno', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Grande', value: '5' },
  { label: 'Enorme', value: '6' },
];
// Pré-visualização do tamanho no menu.
const SIZE_PX: Record<string, string> = { '2': '12px', '3': '14px', '5': '18px', '6': '22px' };
const COLORS = [
  '#111827',
  '#6b7280',
  '#7c3aed',
  '#2563eb',
  '#059669',
  '#d97706',
  '#dc2626',
  '#db2777',
];

interface SignatureToolbarProps {
  uploading: boolean;
  /** Executa um comando do editor (negrito, lista, …) no sítio onde estava o cursor. */
  onCommand: (name: string, value?: string) => void;
  onLink: () => void;
  onImage: () => void;
}

/** Barra do editor visual: texto, tamanho, cor, listas, alinhamento, link e imagem. */
export const SignatureToolbar: React.FC<SignatureToolbarProps> = ({
  uploading,
  onCommand,
  onLink,
  onImage,
}) => {
  // mousedown: não tira o foco (nem a seleção) ao texto do editor.
  const button = (Icon: LucideIcon, label: string, name: string, value?: string) => (
    <button
      type="button"
      className={TOOL}
      title={label}
      aria-label={label}
      onMouseDown={event => (event.preventDefault(), onCommand(name, value))}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <>
      {button(Undo2, 'Desfazer', 'undo')}
      {button(Redo2, 'Refazer', 'redo')}
      {SEP}
      {button(Bold, 'Negrito', 'bold')}
      {button(Italic, 'Itálico', 'italic')}
      {button(Underline, 'Sublinhado', 'underline')}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={TOOL}
            title="Tamanho do texto"
            aria-label="Tamanho do texto"
          >
            Tamanho <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-40 rounded-2xl p-1.5"
          onOpenAutoFocus={event => event.preventDefault()}
        >
          {SIZES.map(size => (
            <button
              key={size.value}
              type="button"
              onMouseDown={event => (event.preventDefault(), onCommand('fontSize', size.value))}
              className="flex w-full items-center rounded-xl px-2.5 py-2 text-left font-semibold hover:bg-rz-canvas"
              style={{ fontSize: SIZE_PX[size.value] }}
            >
              {size.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={TOOL} title="Cor do texto" aria-label="Cor do texto">
            <Palette className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="flex w-auto gap-1.5 rounded-full p-2"
          onOpenAutoFocus={event => event.preventDefault()}
        >
          {COLORS.map(color => (
            <button
              key={color}
              type="button"
              aria-label={`Cor ${color}`}
              onMouseDown={event => (event.preventDefault(), onCommand('foreColor', color))}
              className="h-6 w-6 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: color }}
            />
          ))}
        </PopoverContent>
      </Popover>
      {SEP}
      {button(List, 'Lista', 'insertUnorderedList')}
      {button(ListOrdered, 'Lista numerada', 'insertOrderedList')}
      {button(AlignLeft, 'Alinhar à esquerda', 'justifyLeft')}
      {button(AlignCenter, 'Centrar', 'justifyCenter')}
      {button(AlignRight, 'Alinhar à direita', 'justifyRight')}
      {SEP}
      <button
        type="button"
        className={TOOL}
        onMouseDown={event => (event.preventDefault(), onLink())}
      >
        <Link2 className="h-4 w-4" /> Link
      </button>
      <button
        type="button"
        className={TOOL}
        disabled={uploading}
        onMouseDown={event => (event.preventDefault(), onImage())}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImagePlus className="h-4 w-4" />
        )}{' '}
        Imagem
      </button>
      {button(Eraser, 'Limpar formatação', 'removeFormat')}
    </>
  );
};
