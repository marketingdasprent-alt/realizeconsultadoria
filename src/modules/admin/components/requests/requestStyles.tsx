import React from 'react';
import { absenceTypeColors, absenceTypeLabels, defaultAbsenceTypeColor } from '@/lib/absence-types';
import { cn } from '@/lib/utils';
import { STATUS_LABELS } from '../../lib/absenceRequests';

const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  partially_approved: 'bg-teal-100 text-teal-800',
  rejected: 'bg-rose-100 text-rose-700',
};

export const StatusPill: React.FC<{ status: string; className?: string }> = ({
  status,
  className,
}) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-bold',
      STATUS_CLASSES[status] ?? 'bg-rz-canvas text-rz-muted',
      className
    )}
  >
    {STATUS_LABELS[status] ?? status}
  </span>
);

/** Tipo da ausência com a cor do calendário. */
export const TypeChip: React.FC<{ type: string; className?: string }> = ({ type, className }) => {
  const color = absenceTypeColors[type] ?? defaultAbsenceTypeColor;
  return (
    <span
      style={{ backgroundColor: color.fill, color: color.text }}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold',
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color.text }} />
      {absenceTypeLabels[type] ?? absenceTypeLabels.other}
    </span>
  );
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');

export const PersonAvatar: React.FC<{ name: string; url: string | null; size?: 'sm' | 'lg' }> = ({
  name,
  url,
  size = 'sm',
}) => {
  const box = size === 'lg' ? 'h-12 w-12 text-[15px]' : 'h-9 w-9 text-[12px]';
  if (url)
    return <img src={url} alt="" className={cn(box, 'shrink-0 rounded-full object-cover')} />;
  return (
    <span
      className={cn(
        box,
        'flex shrink-0 items-center justify-center rounded-full bg-rz-primary-soft font-bold text-rz-primary'
      )}
    >
      {initials(name)}
    </span>
  );
};

/** Bloco de texto do painel (nota do colaborador, motivo da rejeição…). */
export const Note: React.FC<{ title: string; tone?: 'red' | 'orange'; children: string }> = ({
  title,
  tone,
  children,
}) => (
  <div
    className={
      tone === 'red'
        ? 'rounded-2xl bg-rose-50 p-3 text-rose-800'
        : tone === 'orange'
          ? 'rounded-2xl bg-orange-50 p-3 text-orange-800'
          : 'rounded-2xl bg-rz-canvas p-3'
    }
  >
    <p className="text-[12px] font-bold uppercase tracking-wide opacity-70">{title}</p>
    <p className="mt-0.5 whitespace-pre-wrap text-[13.5px]">{children}</p>
  </div>
);
