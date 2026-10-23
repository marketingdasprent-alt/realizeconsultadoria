import React from 'react';
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useWorkspace } from '../../context/workspaceContext';
import { useSupportDesk } from '@/modules/support/hooks/useSupportDesk';
import { SETTINGS_MODULE, modulePath, visibleGroups } from '../../lib/navigation';
import { ModuleIcon } from '../ModuleIcon';

interface MobileMenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Menu completo no telemóvel: todos os módulos em mosaicos, por grupo. */
export const MobileMenuSheet: React.FC<MobileMenuSheetProps> = ({ open, onOpenChange }) => {
  const { basePath } = useWorkspace();
  const { isAgent } = useSupportDesk();
  const groups = [
    ...visibleGroups({ supportDesk: isAgent }),
    { label: 'Conta', modules: [SETTINGS_MODULE] },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rz-scroll max-h-[85vh] overflow-y-auto rounded-t-[32px] border-0 bg-rz-canvas px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-3"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-rz-line" aria-hidden />
        <SheetTitle className="mb-4 px-1 text-xl font-extrabold">Todas as ferramentas</SheetTitle>
        <div className="space-y-5">
          {groups.map(group => (
            <section key={group.label}>
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-rz-muted">
                {group.label}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {group.modules.map(module => (
                  <Link
                    key={module.key}
                    to={modulePath(basePath, module)}
                    onClick={() => onOpenChange(false)}
                    className="flex flex-col items-center gap-1.5 rounded-2xl bg-white px-1 py-3 text-center shadow-rz-soft active:scale-95"
                  >
                    <ModuleIcon module={module} size="md" />
                    <span className="line-clamp-2 break-words px-0.5 text-[11px] font-semibold leading-tight">
                      {module.label}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
