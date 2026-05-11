// src/lib/constants.ts
// Constantes centralizadas do projeto

// Mensagens de erro
export const ERROR_MESSAGES = {
  AUTH: {
    INVALID_CREDENTIALS: 'Email ou password incorretos',
    NETWORK_ERROR: 'Erro de conexão. Verifique a sua internet.',
    SESSION_EXPIRED: 'Sua sessão expirou. Por favor, faça login novamente.',
    UNAUTHORIZED: 'Você não tem permissão para acessar este recurso.',
    UNEXPECTED: 'Ocorreu um erro inesperado. Tente novamente.',
  },
  VALIDATION: {
    EMAIL_REQUIRED: 'Email é obrigatório',
    PASSWORD_REQUIRED: 'Password é obrigatória',
    EMAIL_INVALID: 'Email inválido',
    PASSWORD_MIN_LENGTH: 'Password deve ter pelo menos 6 caracteres',
  },
  ADMIN: {
    NOT_FOUND: 'Administrador não encontrado',
    ALREADY_EXISTS: 'Este email já está associado a uma conta',
    OPERATION_FAILED: 'Operação falhou. Tente novamente.',
  },
};

// Rotas
export const ROUTES = {
  PUBLIC: {
    HOME: '/',
    SITE: '/site',
    INSTALL: '/instalar',
    PRIVACY: '/politica-privacidade',
    COOKIES: '/cookies',
    TERMS: '/termos-condicoes',
  },
  AUTH: {
    CALLBACK: '/auth/callback',
    SET_PASSWORD: '/auth/set-password',
  },
  ADMIN: {
    LOGIN: '/admin/login',
    DASHBOARD: '/admin',
    LEGAL: '/admin/juridico',
    COMPANIES: '/admin/empresas',
    EMPLOYEES: '/admin/colaboradores',
    EMPLOYEE_NEW: '/admin/colaboradores/novo',
    EMPLOYEE_EDIT: '/admin/colaboradores/:id',
    CALENDAR: '/admin/calendario',
    REQUESTS: '/admin/pedidos',
    SUPPORT: '/admin/suporte',
    ACCESSES: '/admin/acessos',
    SETTINGS: '/admin/configuracoes',
  },
  EMPLOYEE: {
    LOGIN: '/colaborador/login',
    DASHBOARD: '/colaborador',
    TICKETS: '/colaborador/tickets',
    DOCUMENTS: '/colaborador/documentos',
  },
};

// Timeouts
export const TIMEOUTS = {
  TOAST: 3000,
  REQUEST: 30000,
  SESSION_CHECK: 60000,
};

// Permissões
export const PERMISSIONS = {
  ADMIN: 'admin',
  COMPANY_ADMIN: 'company_admin',
  EMPLOYEE: 'employee',
} as const;

// Tamanhos de paginação
export const PAGE_SIZES = {
  DEFAULT: 20,
  SMALL: 10,
  LARGE: 50,
} as const;

// Status de ausência
export const ABSENCE_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PARTIALLY_APPROVED: 'partially_approved',
} as const;

// Status de ticket
export const TICKET_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  CLOSED: 'closed',
  RESOLVED: 'resolved',
} as const;
