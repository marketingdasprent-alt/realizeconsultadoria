// Navegação do Realize 2.0 (briefing §4): módulos agrupados por função.
// `path` é relativo à base da área (/colaborador); '' é o Messenger (página inicial).
import {
  Award,
  CalendarDays,
  Clock,
  FolderOpen,
  LifeBuoy,
  ListChecks,
  Mail,
  MessagesSquare,
  Network,
  Newspaper,
  Palmtree,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type ModuleKey =
  | 'messenger'
  | 'feed'
  | 'email'
  | 'calendar'
  | 'tasks'
  | 'documents'
  | 'tickets'
  | 'timeclock'
  | 'absences'
  | 'people'
  | 'orgchart'
  | 'appreciations'
  | 'ai'
  | 'settings';

export interface WorkspaceModule {
  key: ModuleKey;
  label: string;
  /** Caminho relativo à base da área ('' = página inicial). */
  path: string;
  icon: LucideIcon;
  /** Gradiente do mosaico do ícone (classes Tailwind). */
  tint: string;
  /** Já existe (true) ou ainda está planeado (página "Em construção"). */
  ready: boolean;
  description: string;
  /** Fase do plano de desenvolvimento em que chega (briefing §29). */
  phase?: number;
  /** O que vai trazer (página "Em construção"). */
  planned?: string[];
}

export interface WorkspaceGroup {
  label: string;
  modules: WorkspaceModule[];
}

export const WORKSPACE_GROUPS: WorkspaceGroup[] = [
  {
    label: 'Comunicação',
    modules: [
      {
        key: 'messenger',
        label: 'Mensagens',
        path: '',
        icon: MessagesSquare,
        tint: 'from-violet-500 to-indigo-500',
        ready: true,
        description: 'Conversas privadas, grupos e canais da organização.',
        phase: 2,
      },
      {
        key: 'feed',
        label: 'Feed',
        // Inclui os avisos dos RH (o antigo /colaborador/avisos redireciona para aqui).
        path: 'feed',
        icon: Newspaper,
        tint: 'from-orange-400 to-rose-500',
        ready: true,
        description: 'Comunicados, novidades e reconhecimentos da organização.',
      },
      {
        key: 'email',
        label: 'Webmail',
        path: 'email',
        icon: Mail,
        tint: 'from-sky-400 to-blue-600',
        ready: true,
        phase: 4,
        description: 'As suas caixas de correio, todas num só lugar.',
        planned: [
          'Gmail, Microsoft 365, Outlook e IMAP',
          'Várias contas e caixa de entrada unificada',
          'Assinaturas de email por conta',
          'Transformar um email em tarefa ou evento',
        ],
      },
      {
        key: 'calendar',
        label: 'Calendário',
        path: 'calendario',
        icon: CalendarDays,
        tint: 'from-rose-400 to-red-500',
        ready: true,
        phase: 4,
        description: 'Reuniões, eventos, férias e ausências num único calendário.',
        planned: [
          'Vistas de dia, semana, mês e agenda',
          'Calendários pessoal, da equipa e da empresa',
          'Ligação ao Google Calendar',
          'Marcar férias selecionando os dias',
        ],
      },
    ],
  },
  {
    label: 'Trabalho',
    modules: [
      {
        key: 'tasks',
        label: 'Tarefas',
        path: 'tarefas',
        icon: ListChecks,
        tint: 'from-emerald-400 to-teal-500',
        ready: true,
        phase: 4,
        description: 'Organize o trabalho da equipa, com prazos e responsáveis.',
        planned: [
          'Lista, quadro Kanban e calendário',
          'Subtarefas, listas de verificação e anexos',
          'Criar tarefas a partir de mensagens e emails',
        ],
      },
      {
        key: 'documents',
        label: 'Documentos',
        path: 'documentos',
        icon: FolderOpen,
        tint: 'from-amber-400 to-orange-500',
        ready: true,
        description:
          'Em breve: o editor de documentos da empresa. Os documentos pessoais e recibos estão nas Definições.',
      },
      {
        key: 'tickets',
        label: 'Tickets',
        path: 'tickets',
        icon: LifeBuoy,
        tint: 'from-cyan-400 to-sky-600',
        ready: true,
        description: 'Pedidos de suporte aos Recursos Humanos.',
      },
      {
        key: 'timeclock',
        label: 'Ponto',
        path: 'ponto',
        icon: Clock,
        tint: 'from-indigo-400 to-blue-600',
        ready: true,
        description: 'Registos de ponto, pausas e resumo de horas.',
      },
      {
        key: 'absences',
        label: 'Férias e ausências',
        path: 'pedidos',
        icon: Palmtree,
        tint: 'from-lime-400 to-green-600',
        ready: true,
        description: 'Pedidos de férias, baixas, consultas e outras ausências.',
      },
    ],
  },
  {
    label: 'Organização',
    modules: [
      {
        key: 'people',
        label: 'Colaboradores',
        path: 'pessoas',
        icon: Users,
        tint: 'from-fuchsia-400 to-purple-600',
        ready: true,
        phase: 2,
        description: 'Encontre colegas e veja os perfis da organização.',
        planned: [
          'Pesquisa por nome, empresa, departamento e cargo',
          'Perfis com contactos e disponibilidade',
          'Iniciar conversa diretamente do perfil',
        ],
      },
      {
        key: 'orgchart',
        label: 'Organograma',
        path: 'organograma',
        icon: Network,
        tint: 'from-teal-400 to-cyan-600',
        ready: true,
        phase: 4,
        description: 'A estrutura da organização: empresas, departamentos e equipas.',
        planned: ['Navegação e pesquisa na estrutura', 'Acesso direto aos perfis'],
      },
      {
        key: 'appreciations',
        label: 'Apreciações',
        path: 'apreciacoes',
        icon: Award,
        tint: 'from-pink-400 to-rose-500',
        ready: true,
        phase: 2,
        description: 'Reconheça o bom trabalho dos seus colegas.',
        planned: [
          'Excelente trabalho, Espírito de equipa, Obrigado…',
          'Mensagem opcional, pública ou privada',
          'Apreciações recebidas no perfil e no Feed',
        ],
      },
      {
        key: 'ai',
        label: 'Realize AI',
        path: 'ai',
        icon: Sparkles,
        tint: 'from-violet-500 via-fuchsia-500 to-amber-400',
        ready: true,
        phase: 5,
        description: 'O seu assistente, sempre dentro das suas permissões.',
        planned: [
          'Perguntar pelas férias, tarefas ou registos de ponto',
          'Resumir conversas e emails',
          'Encontrar documentos e procedimentos internos',
        ],
      },
    ],
  },
];

export const SETTINGS_MODULE: WorkspaceModule = {
  key: 'settings',
  label: 'Definições',
  path: 'definicoes',
  icon: Settings,
  tint: 'from-slate-400 to-slate-600',
  ready: true,
  phase: 1,
  description: 'Preferências, notificações e segurança da conta.',
  planned: ['Tema claro ou escuro', 'Notificações', 'Sessões e segurança'],
};

export const ALL_MODULES: WorkspaceModule[] = [
  ...WORKSPACE_GROUPS.flatMap(group => group.modules),
  SETTINGS_MODULE,
];

export const getModule = (key: ModuleKey): WorkspaceModule =>
  ALL_MODULES.find(module => module.key === key) as WorkspaceModule;

/** Caminho absoluto de um módulo a partir da base da área. */
export const modulePath = (basePath: string, module: Pick<WorkspaceModule, 'path'>): string =>
  module.path ? `${basePath}/${module.path}` : basePath;

/** Atalhos da barra inferior no telemóvel (o resto fica no Menu). */
export const MOBILE_TABS: ModuleKey[] = ['messenger', 'timeclock', 'absences', 'documents'];
