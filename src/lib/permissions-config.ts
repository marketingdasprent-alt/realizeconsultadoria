// Permission topics configuration for each module
// Organized by functionality as requested

export interface TopicConfig {
  key: string;
  label: string;
  description: string;
  hasView: boolean;
  hasExecute: boolean;
}

export interface ModuleTopicsConfig {
  moduleKey: string;
  moduleLabel: string;
  topics: TopicConfig[];
}

export const PERMISSIONS_CONFIG: ModuleTopicsConfig[] = [
  {
    moduleKey: 'dashboard',
    moduleLabel: 'Dashboard',
    topics: [
      { key: 'view', label: 'Ver dashboard', description: 'Visualizar estatísticas e resumos', hasView: true, hasExecute: false }
    ]
  },
  {
    moduleKey: 'companies',
    moduleLabel: 'Empresas',
    topics: [
      { key: 'view', label: 'Ver empresas', description: 'Visualizar lista de empresas', hasView: true, hasExecute: false },
      { key: 'manage', label: 'Gerir empresas', description: 'Criar, editar e eliminar empresas', hasView: false, hasExecute: true }
    ]
  },
  {
    moduleKey: 'employees',
    moduleLabel: 'Colaboradores',
    topics: [
      { key: 'view', label: 'Ver colaboradores', description: 'Visualizar lista de colaboradores', hasView: true, hasExecute: false },
      { key: 'create', label: 'Criar colaboradores', description: 'Adicionar novos colaboradores', hasView: false, hasExecute: true },
      { key: 'edit', label: 'Editar colaboradores', description: 'Modificar dados de colaboradores', hasView: false, hasExecute: true },
      { key: 'delete', label: 'Eliminar colaboradores', description: 'Remover colaboradores do sistema', hasView: false, hasExecute: true },
      { key: 'vacation', label: 'Gerir férias', description: 'Configurar dias de férias', hasView: false, hasExecute: true },
      { key: 'notifications', label: 'Enviar avisos', description: 'Enviar avisos individuais', hasView: false, hasExecute: true },
      { key: 'reset_password', label: 'Reset password', description: 'Redefinir passwords de colaboradores', hasView: false, hasExecute: true }
    ]
  },
  {
    moduleKey: 'accesses',
    moduleLabel: 'Acessos',
    topics: [
      { key: 'view', label: 'Ver acessos', description: 'Visualizar lista de acessos', hasView: true, hasExecute: false },
      { key: 'manage', label: 'Gerir acessos', description: 'Criar, editar e eliminar acessos', hasView: false, hasExecute: true },
      { key: 'assignments', label: 'Gerir atribuições', description: 'Criar, editar e devolver atribuições de equipamentos', hasView: true, hasExecute: true }
    ]
  },
  {
    moduleKey: 'requests',
    moduleLabel: 'Pedidos',
    topics: [
      { key: 'view', label: 'Ver pedidos', description: 'Visualizar pedidos de ausência', hasView: true, hasExecute: false },
      { key: 'approve', label: 'Aprovar pedidos', description: 'Aprovar pedidos total ou parcialmente', hasView: false, hasExecute: true },
      { key: 'reject', label: 'Rejeitar pedidos', description: 'Rejeitar pedidos de ausência', hasView: false, hasExecute: true }
    ]
  },
  {
    moduleKey: 'support',
    moduleLabel: 'Suporte',
    topics: [
      { key: 'view', label: 'Ver tickets', description: 'Visualizar tickets de suporte', hasView: true, hasExecute: false },
      { key: 'manage', label: 'Gerir tickets', description: 'Alterar status e adicionar notas', hasView: false, hasExecute: true }
    ]
  },
  {
    moduleKey: 'calendar',
    moduleLabel: 'Calendário',
    topics: [
      { key: 'view', label: 'Ver calendário', description: 'Visualizar calendário de ausências', hasView: true, hasExecute: false }
    ]
  },
  {
    moduleKey: 'settings',
    moduleLabel: 'Configurações',
    topics: [
      { key: 'profile', label: 'Gerir perfil', description: 'Alterar dados do próprio perfil', hasView: true, hasExecute: true },
      { key: 'admins', label: 'Gerir administradores', description: 'Convidar e remover administradores', hasView: true, hasExecute: true },
      { key: 'groups', label: 'Gerir grupos', description: 'Criar e editar grupos de acesso', hasView: true, hasExecute: true },
      { key: 'notifications', label: 'Gerir avisos', description: 'Criar avisos globais', hasView: true, hasExecute: true },
      { key: 'support_subjects', label: 'Gerir assuntos suporte', description: 'Configurar assuntos de suporte', hasView: true, hasExecute: true }
    ]
  }
];

// Helper to get all modules
export const getAllModuleKeys = (): string[] => {
  return PERMISSIONS_CONFIG.map(m => m.moduleKey);
};

// Helper to get module config
export const getModuleConfig = (moduleKey: string): ModuleTopicsConfig | undefined => {
  return PERMISSIONS_CONFIG.find(m => m.moduleKey === moduleKey);
};

// Helper to get topic config
export const getTopicConfig = (moduleKey: string, topicKey: string): TopicConfig | undefined => {
  const module = getModuleConfig(moduleKey);
  return module?.topics.find(t => t.key === topicKey);
};

// Module labels for backwards compatibility
export const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  PERMISSIONS_CONFIG.map(m => [m.moduleKey, m.moduleLabel])
);

export const ALL_MODULE_KEYS = getAllModuleKeys();
