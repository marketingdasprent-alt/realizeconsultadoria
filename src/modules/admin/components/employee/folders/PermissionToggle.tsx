import React from 'react';
import { cn } from '@/lib/utils';
import type { FolderPermission } from '../../../services/folderAccessService';

interface PermissionToggleProps {
  value: FolderPermission;
  onChange: (value: FolderPermission) => void;
  size?: 'sm' | 'md';
}

/** Ler / Editar numa pasta da empresa. */
export const PermissionToggle: React.FC<PermissionToggleProps> = ({
  value,
  onChange,
  size = 'md',
}) => (
  <div className="flex rounded-full bg-rz-canvas p-0.5" role="group" aria-label="Permissão">
    {(['read', 'edit'] as const).map(option => (
      <button
        key={option}
        type="button"
        aria-pressed={value === option}
        onClick={() => option !== value && onChange(option)}
        className={cn(
          'rounded-full font-semibold',
          size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8 px-3 text-[13px]',
          value === option ? 'bg-white text-rz-ink shadow-sm' : 'text-rz-muted'
        )}
      >
        {option === 'read' ? 'Ler' : 'Editar'}
      </button>
    ))}
  </div>
);
