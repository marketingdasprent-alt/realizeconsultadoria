import React from 'react';
import { Link } from 'react-router-dom';
import { NotebookPen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppreciations } from '@/modules/social/hooks/useAppreciations';
import { AppreciationsCard } from '../components/profile/AppreciationsCard';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileInfoCard } from '../components/profile/ProfileInfoCard';
import { WorkspacePage } from '../components/WorkspacePage';
import { useWorkspace } from '../context/workspaceContext';
import { getModule, modulePath, type ModuleKey } from '../lib/navigation';

// Separadores do perfil (briefing §6): os restantes abrem o módulo respetivo.
const TAB_MODULES: ModuleKey[] = ['tasks', 'calendar', 'documents', 'feed', 'timeclock'];

/** Perfil do colaborador autenticado. */
const ProfilePage: React.FC = () => {
  const { user, basePath } = useWorkspace();
  const { received } = useAppreciations({ userId: user.userId });

  return (
    <WorkspacePage>
      <ProfileHeader user={user} isOwn isOnline />

      <nav
        className="scrollbar-hide mt-4 flex gap-2 overflow-x-auto"
        aria-label="Separadores do perfil"
      >
        <span className={cn(TAB, 'bg-rz-ink text-white')}>Geral</span>
        {TAB_MODULES.map(key => {
          const module = getModule(key);
          return (
            <Link
              key={key}
              to={modulePath(basePath, module)}
              className={cn(TAB, 'bg-white text-rz-muted ring-1 ring-rz-line hover:text-rz-ink')}
            >
              {module.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <ProfileInfoCard user={user} isOwn />
          <section className="rounded-[28px] bg-white p-5 shadow-rz-soft ring-1 ring-rz-line md:p-6">
            <h2 className="text-[17px] font-bold">Sobre mim</h2>
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-dashed border-rz-line p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-violet-100 text-rz-primary">
                <NotebookPen className="h-5 w-5" />
              </span>
              <p className="text-[13.5px] text-rz-muted">
                Uma breve apresentação, competências e interesses profissionais — para os colegas o
                conhecerem melhor. Em breve poderá preenchê-lo aqui.
              </p>
            </div>
          </section>
        </div>
        <AppreciationsCard received={received} isOwn />
      </div>
    </WorkspacePage>
  );
};

const TAB = 'shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors';

export default ProfilePage;
