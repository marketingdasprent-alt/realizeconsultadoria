import React, { useState } from 'react';
import { companyInitials } from '@/lib/companyName';
import { cn } from '@/lib/utils';
import { companyLogoService } from '@/modules/admin/services/companyLogoService';

const SIZES = {
  sm: 'h-8 w-8 rounded-[10px] text-[11px]',
  md: 'h-10 w-10 rounded-xl text-[13px]',
  lg: 'h-24 w-24 rounded-2xl text-[28px]',
} as const;

interface CompanyLogoProps {
  name: string;
  logoPath?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

/**
 * A logo da empresa, ou as iniciais quando não há (ou não carrega). Fica sempre sobre fundo claro:
 * as logos costumam ter letras escuras e desapareciam no tema escuro.
 */
export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  name,
  logoPath,
  size = 'md',
  className,
}) => {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const url = logoPath && logoPath !== failedPath ? companyLogoService.publicUrl(logoPath) : null;
  return url ? (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden ring-1 ring-rz-line',
        SIZES[size],
        className
      )}
      style={{ backgroundColor: '#fff' }}
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        className="h-full w-full object-contain p-1"
        onError={() => setFailedPath(logoPath ?? null)}
      />
    </span>
  ) : (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center bg-rz-primary-soft font-bold text-rz-primary',
        SIZES[size],
        className
      )}
    >
      {companyInitials(name)}
    </span>
  );
};
