// Pré-visualização do Realize 2.0 só em desenvolvimento (npm run dev → /dev/realize-2):
// mostra a estrutura nova com dados de exemplo, sem iniciar sessão. Não entra na build
// de produção (a rota só é registada com import.meta.env.DEV).
import React from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ROUTES } from '@/lib/constants';
import { DemoMessengerProvider } from '@/modules/messenger/context/MessengerProvider';
import MessengerPage from '@/modules/messenger/pages/MessengerPage';
import { ModuleIcon } from '../components/ModuleIcon';
import { WorkspacePage } from '../components/WorkspacePage';
import { WorkspaceShell } from '../components/shell/WorkspaceShell';
import type { WorkspaceContextValue } from '../context/workspaceContext';
import { ALL_MODULES, type ModuleKey, type WorkspaceModule } from '../lib/navigation';
import AppreciationsPage from '@/modules/social/pages/AppreciationsPage';
import ColleagueProfilePage from '@/modules/social/pages/ColleagueProfilePage';
import FeedPage from '@/modules/social/pages/FeedPage';
import AbsencesPage from '@/modules/absences/pages/AbsencesPage';
import MyTimeClockPage from '@/modules/timeclock/pages/MyTimeClockPage';
import SupportPage from '@/modules/support/pages/SupportPage';
import MyDocumentsPage from '@/modules/documents/pages/MyDocumentsPage';
import PersonalDocumentsPage from '@/modules/documents/pages/PersonalDocumentsPage';
import PeoplePage from '@/modules/social/pages/PeoplePage';
import ModuleComingSoonPage from '../pages/ModuleComingSoonPage';
import ProfilePage from '../pages/ProfilePage';
import SettingsPage from '../pages/SettingsPage';
import WebmailPage from '@/modules/webmail/pages/WebmailPage';
import TasksPage from '@/modules/tasks/pages/TasksPage';
import CalendarPage from '@/modules/calendar/pages/CalendarPage';
import OrgChartPage from '@/modules/social/pages/OrgChartPage';
import AiPage from '@/modules/ai/pages/AiPage';
import { PreviewWorkdayProvider } from './PreviewWorkdayProvider';

const BASE_PATH = '/dev/realize-2';

// Módulos com dados de exemplo na pré-visualização (os outros mostram o aviso de dados reais).
const DEMO_PAGES = new Set<ModuleKey>([
  'feed',
  'people',
  'appreciations',
  'absences',
  'timeclock',
  'tickets',
  'documents',
  'settings',
  'email',
  'tasks',
  'calendar',
  'orgchart',
]);

const PREVIEW: WorkspaceContextValue = {
  user: {
    userId: 'me',
    employeeId: 'preview',
    companyId: 'preview',
    name: 'Joana Silva',
    email: 'joana.silva@exemplo.pt',
    position: 'Gestora de Operações',
    department: 'Operações',
    companyName: 'Realize Consultadoria',
    phone: '+351 912 345 678',
    hireDate: '2023-03-01',
  },
  basePath: BASE_PATH,
  isPreview: true,
  onLogout: () => toast({ title: 'Pré-visualização', description: 'Aqui terminaria a sessão.' }),
  onChangePassword: () =>
    toast({ title: 'Pré-visualização', description: 'Aqui abriria a alteração da palavra-passe.' }),
};

/** Módulo que já existe mas usa dados reais: na pré-visualização explica como o ver. */
const RealDataNotice: React.FC<{ module: WorkspaceModule }> = ({ module }) => (
  <WorkspacePage width="narrow">
    <div className="rounded-[32px] bg-white p-8 text-center shadow-rz-soft ring-1 ring-rz-line">
      <ModuleIcon module={module} size="xl" className="mx-auto" />
      <h1 className="mt-5 text-2xl font-extrabold">{module.label}</h1>
      <p className="mx-auto mt-2 max-w-md text-[15px] text-rz-muted">
        Esta página já existe e usa dados reais. Para a ver dentro da estrutura nova, entre com uma
        conta de colaborador.
      </p>
      <Link
        to={ROUTES.EMPLOYEE.LOGIN}
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-rz-primary px-5 text-sm font-semibold text-white"
      >
        <LogIn className="h-4 w-4" /> Entrar como colaborador
      </Link>
    </div>
  </WorkspacePage>
);

const WorkspacePreview: React.FC = () => (
  <PreviewWorkdayProvider>
    <DemoMessengerProvider>
      <WorkspaceShell value={PREVIEW}>
        <Routes>
          <Route index element={<MessengerPage />} />
          <Route path="perfil" element={<ProfilePage />} />
          <Route path="feed" element={<FeedPage />} />
          <Route path="pedidos" element={<AbsencesPage />} />
          <Route path="ponto" element={<MyTimeClockPage />} />
          <Route path="tickets" element={<SupportPage />} />
          <Route path="documentos" element={<MyDocumentsPage />} />
          <Route path="definicoes/documentos" element={<PersonalDocumentsPage />} />
          <Route path="definicoes" element={<SettingsPage />} />
          <Route path="email" element={<WebmailPage />} />
          <Route path="tarefas" element={<TasksPage />} />
          <Route path="calendario" element={<CalendarPage />} />
          <Route path="organograma" element={<OrgChartPage />} />
          <Route path="ai" element={<AiPage />} />
          <Route path="pessoas" element={<PeoplePage />} />
          <Route path="pessoas/:userId" element={<ColleagueProfilePage />} />
          <Route path="apreciacoes" element={<AppreciationsPage />} />
          {ALL_MODULES.filter(module => module.path && !DEMO_PAGES.has(module.key)).map(module => (
            <Route
              key={module.key}
              path={module.path}
              element={
                module.ready ? (
                  <RealDataNotice module={module} />
                ) : (
                  <ModuleComingSoonPage moduleKey={module.key} />
                )
              }
            />
          ))}
        </Routes>
      </WorkspaceShell>
    </DemoMessengerProvider>
  </PreviewWorkdayProvider>
);

export default WorkspacePreview;
