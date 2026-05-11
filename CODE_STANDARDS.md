// GUIA DE PADRÕES E BOAS PRÁTICAS

/*
╔════════════════════════════════════════════════════════════════════════════╗
║          PADRÕES DE CÓDIGO - GUIA PARA DESENVOLVIMENTO ENTERPRISE          ║
╚════════════════════════════════════════════════════════════════════════════╝


1. ESTRUTURA DO PROJETO
═══════════════════════════════════════════════════════════════════════════

RECOMENDADO:

src/
├── modules/                      # Features agrupadas por domínio
│   ├── admin/
│   │   ├── pages/               # Páginas da área admin
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── EmployeesPage.tsx
│   │   │   └── CompaniesPage.tsx
│   │   ├── components/          # Componentes específicos do admin
│   │   │   ├── AdminHeader.tsx
│   │   │   ├── EmployeeForm.tsx
│   │   │   └── CompanyTable.tsx
│   │   ├── hooks/               # Hooks customizados do admin
│   │   │   ├── useAdminData.ts
│   │   │   └── useEmployeeForm.ts
│   │   ├── services/            # Serviços de API
│   │   │   ├── employeeService.ts
│   │   │   └── companyService.ts
│   │   ├── types.ts             # Types TypeScript do módulo
│   │   └── index.ts             # Barrel export
│   │
│   ├── employee/                # Feature de employee
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types.ts
│   │
│   └── auth/                    # Tudo relacionado a autenticação
│       ├── contexts/            # AuthContext
│       ├── hooks/               # useAuth
│       ├── components/          # ProtectedRoute, LoginForm
│       ├── services/            # authService
│       └── types.ts
│
├── shared/                       # Código compartilhado
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   └── ...ui components
│   ├── hooks/
│   │   ├── use-toast.ts
│   │   ├── use-mobile.ts
│   │   └── useDebounce.ts
│   ├── utils/
│   │   ├── validators.ts
│   │   ├── formatters.ts
│   │   ├── apiClient.ts
│   │   └── logger.ts
│   ├── constants/
│   │   └── constants.ts
│   ├── types/
│   │   └── common.ts
│   └── styles/
│       └── globals.css
│
├── App.tsx                       # Root component
├── main.tsx                      # Entry point
└── vite-env.d.ts


2. PADRÃO DE HOOKS CUSTOMIZADOS
═══════════════════════════════════════════════════════════════════════════

✅ BOM: Hooks com lógica clara e reutilizável

// src/modules/admin/hooks/useEmployeeForm.ts
import { useState, useCallback } from 'react';
import { employeeService } from '../services/employeeService';
import type { Employee } from '../types';

interface UseEmployeeFormResult {
  employee: Employee | null;
  isLoading: boolean;
  error: string | null;
  fetchEmployee: (id: string) => Promise<void>;
  updateEmployee: (id: string, data: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
}

export const useEmployeeForm = (): UseEmployeeFormResult => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployee = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await employeeService.getById(id);
      if (fetchError) throw fetchError;
      setEmployee(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar colaborador');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateEmployee = useCallback(
    async (id: string, data: Partial<Employee>) => {
      setIsLoading(true);
      setError(null);
      try {
        const { data: updated, error: updateError } = 
          await employeeService.update(id, data);
        if (updateError) throw updateError;
        setEmployee(updated);
      } catch (err: any) {
        setError(err.message || 'Erro ao atualizar colaborador');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const deleteEmployee = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { error: deleteError } = await employeeService.delete(id);
      if (deleteError) throw deleteError;
      setEmployee(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao eliminar colaborador');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    employee,
    isLoading,
    error,
    fetchEmployee,
    updateEmployee,
    deleteEmployee,
  };
};


✗ RUIM: Lógica espalhada no componente

const EmployeeForm = ({ id }) => {
  const [employee, setEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setIsLoading(true);
      const { data } = await supabase.from('employees').select().eq('id', id);
      setEmployee(data?.[0]);
      setIsLoading(false);
    };
    fetch();
  }, [id]);

  // ... resto do componente
};


3. PADRÃO DE SERVIÇOS
═══════════════════════════════════════════════════════════════════════════

✅ BOM: Serviço tipado com error handling consistente

// src/modules/admin/services/employeeService.ts
import { apiClient } from '@/shared/utils/apiClient';
import type { Employee, CreateEmployeeRequest } from '../types';

export const employeeService = {
  /**
   * Obter todos os colaboradores com paginação
   */
  getAll: async (page = 1, pageSize = 20) => {
    return apiClient.query<Employee>('employees', {
      select: '*, companies(name)',
      order: { column: 'first_name' },
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  },

  /**
   * Obter colaborador por ID
   */
  getById: async (id: string) => {
    const { data, error } = await apiClient.query<Employee>('employees', {
      select: '*, companies(*)',
      filter: [{ column: 'id', operator: 'eq', value: id }],
    });

    if (error || !data?.[0]) {
      return { data: null, error: new Error('Colaborador não encontrado') };
    }

    return { data: data[0], error: null };
  },

  /**
   * Criar novo colaborador
   */
  create: async (employee: CreateEmployeeRequest) => {
    return apiClient.insert<Employee>('employees', employee);
  },

  /**
   * Atualizar colaborador
   */
  update: async (id: string, employee: Partial<Employee>) => {
    return apiClient.update<Employee>('employees', id, employee);
  },

  /**
   * Eliminar colaborador
   */
  delete: async (id: string) => {
    return apiClient.delete('employees', id);
  },
};


4. PADRÃO DE COMPONENTES
═══════════════════════════════════════════════════════════════════════════

✅ BOM: Componente com separação clara de responsabilidades

interface EmployeeFormProps {
  id?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const EmployeeForm: React.FC<EmployeeFormProps> = ({
  id,
  onSuccess,
  onCancel,
}) => {
  const { toast } = useToast();
  const { employee, isLoading, error, fetchEmployee, updateEmployee } = 
    useEmployeeForm();

  // Carregar dados ao montar
  useEffect(() => {
    if (id) {
      fetchEmployee(id);
    }
  }, [id, fetchEmployee]);

  // Handler de submit
  const handleSubmit = async (data: Partial<Employee>) => {
    try {
      if (id) {
        await updateEmployee(id, data);
      } else {
        // Criar novo
      }

      toast({
        title: 'Sucesso',
        description: 'Colaborador salvo com sucesso',
      });

      onSuccess?.();
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Form
      initialValues={employee}
      onSubmit={handleSubmit}
    >
      {/* Form fields */}
    </Form>
  );
};


5. PADRÃO DE VALIDAÇÃO
═══════════════════════════════════════════════════════════════════════════

✅ BOM: Usar Zod para validação tipada

// src/modules/admin/types.ts
import { z } from 'zod';

export const createEmployeeSchema = z.object({
  first_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  last_name: z.string().min(2, 'Sobrenome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  company_id: z.string().uuid('ID da empresa inválido'),
  is_active: z.boolean().default(true),
});

export type CreateEmployeeRequest = z.infer<typeof createEmployeeSchema>;
export type Employee = CreateEmployeeRequest & { id: string; created_at: string };

// Uso no componente:
const { formState: { errors } } = useForm({
  resolver: zodResolver(createEmployeeSchema),
});


6. PADRÃO DE ERROR HANDLING
═══════════════════════════════════════════════════════════════════════════

✅ BOM: Error handling consistente em toda a aplicação

// src/shared/utils/errorHandler.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public code: string = 'UNKNOWN_ERROR',
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const handleError = (error: any): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  if (error.status === 401) {
    return new AppError(
      'Sessão expirada. Por favor, faça login novamente.',
      'UNAUTHORIZED',
      401
    );
  }

  if (error.status === 403) {
    return new AppError(
      'Você não tem permissão para esta ação.',
      'FORBIDDEN',
      403
    );
  }

  if (error.status === 404) {
    return new AppError(
      'Recurso não encontrado.',
      'NOT_FOUND',
      404
    );
  }

  return new AppError(
    error.message || 'Erro desconhecido',
    'UNKNOWN_ERROR'
  );
};


7. PADRÃO DE TIPOS
═══════════════════════════════════════════════════════════════════════════

✅ BOM: Tipos bem organizados

// src/shared/types/common.ts
export interface ApiResponse<T> {
  data: T | null;
  error: Error | null;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ListFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}


8. PADRÃO DE LOGGING
═══════════════════════════════════════════════════════════════════════════

✅ BOM: Logging estruturado

// src/shared/utils/logger.ts
export const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data);
  },

  error: (message: string, error?: Error | any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
    // Enviar para Sentry em produção
    if (import.meta.env.PROD) {
      // sentryClient.captureException(error);
    }
  },

  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data);
  },

  debug: (message: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, data);
    }
  },
};


9. PADRÃO DE COMPONENTES DE UI
═══════════════════════════════════════════════════════════════════════════

✅ BOM: Componentes reutilizáveis bem documentados

/**
 * Botão customizado da aplicação
 * 
 * @param variant - Estilo do botão: 'primary' | 'secondary' | 'danger'
 * @param size - Tamanho: 'sm' | 'md' | 'lg'
 * @param isLoading - Mostrar loading state
 * @param disabled - Desabilitar botão
 * @param children - Conteúdo do botão
 */
interface CustomButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<CustomButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading,
  disabled,
  children,
  ...props
}) => {
  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        'rounded-md font-medium transition-colors',
        variantClasses[variant],
        sizeClasses[size],
        (disabled || isLoading) && 'opacity-50 cursor-not-allowed'
      )}
      {...props}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
      {children}
    </button>
  );
};


10. CHECKLIST DE QUALIDADE DE CÓDIGO
═══════════════════════════════════════════════════════════════════════════

Antes de fazer commit:

[ ] Sem console.log/error em produção
[ ] Sem comentários obsoletos
[ ] Sem código duplicado (DRY)
[ ] Sem magic numbers/strings (usar constantes)
[ ] Tipagem completa (sem 'any')
[ ] Error handling apropriado
[ ] Nomes descritivos para variáveis/funções
[ ] Funções com responsabilidade única (SRP)
[ ] JSDoc comentários para funções públicas
[ ] Tests cobrindo casos principais
[ ] Performance: sem re-renders desnecessários
[ ] Acessibilidade: ARIA labels, semantic HTML
[ ] Mobile-responsive design
[ ] Tratamento de loading states
[ ] Validação de inputs


11. GIT WORKFLOW
═══════════════════════════════════════════════════════════════════════════

Commit messages seguir formato:

feat: Adicionar novo componente de dashboard
fix: Corrigir bug no login
refactor: Reorganizar estrutura de pastas
docs: Adicionar documentação de API
test: Adicionar testes para AuthContext
chore: Atualizar dependências

Exemplo:
git commit -m "feat: Implementar sistema de permissões centralizado

- Criar AuthContext para gerenciar estado
- Implementar ProtectedRoute para rotas privadas
- Refatorar LoginPage para usar novo contexto
- Adicionar validação de role na camada de rotas"

*/
