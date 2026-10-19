import {
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  Folder,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import type { FileKind } from '../../lib/companyFiles';

/** Ícone e cor de cada tipo de ficheiro. */
export const KIND_STYLES: Record<FileKind, { icon: LucideIcon; tint: string }> = {
  folder: { icon: Folder, tint: 'bg-amber-100 text-amber-600' },
  word: { icon: FileText, tint: 'bg-blue-100 text-blue-600' },
  cell: { icon: FileSpreadsheet, tint: 'bg-emerald-100 text-emerald-600' },
  slide: { icon: Presentation, tint: 'bg-orange-100 text-orange-600' },
  pdf: { icon: FileType2, tint: 'bg-rose-100 text-rose-600' },
  image: { icon: FileImage, tint: 'bg-violet-100 text-violet-600' },
  other: { icon: File, tint: 'bg-slate-100 text-slate-500' },
};
