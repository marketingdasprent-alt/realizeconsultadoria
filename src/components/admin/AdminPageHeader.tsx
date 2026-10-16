import React from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ModuleIcon } from '@/modules/workspace/components/ModuleIcon';
import { findAdminNavItem } from '@/components/layout/adminNavigation';

interface AdminPageTitleProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}

/** Mosaico do módulo (o mesmo do menu) + título + descrição da página. */
export const AdminPageTitle: React.FC<AdminPageTitleProps> = ({
  title,
  description,
  className,
}) => {
  const { pathname } = useLocation();
  const module = findAdminNavItem(pathname);

  return (
    <div className={cn('flex min-w-0 items-center gap-4', className)}>
      {module && (
        <ModuleIcon
          module={module}
          size="md"
          className="hidden h-12 w-12 rounded-2xl sm:inline-flex [&>svg]:h-6 [&>svg]:w-6"
        />
      )}
      <div className="min-w-0">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-rz-ink sm:text-[30px]">
          {title}
        </h1>
        {description && <p className="mt-0.5 text-[14.5px] text-rz-muted">{description}</p>}
      </div>
    </div>
  );
};

interface AdminPageHeaderProps extends AdminPageTitleProps {
  /** Botões à direita (ex.: Novo colaborador). */
  actions?: React.ReactNode;
}

/** Cabeçalho das páginas do admin: título do módulo à esquerda e ações à direita. */
export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  title,
  description,
  actions,
  className,
}) => (
  <div className={cn('flex flex-wrap items-center justify-between gap-4', className)}>
    <AdminPageTitle title={title} description={description} />
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
