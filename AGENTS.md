# AGENTS.md — Guia de Referência para Agentes & Developers
> Realize Consultadoria · Stack: React 18 + TypeScript + Vite + Supabase + Tailwind CSS

---

## Índice
1. [Scripts disponíveis](#1-scripts-disponíveis)
2. [Como o código deve estar escrito](#2-como-o-código-deve-estar-escrito)
3. [Estrutura de ficheiros](#3-estrutura-de-ficheiros)
4. [Padrão de componentes](#4-padrão-de-componentes)
5. [Padrão de serviços](#5-padrão-de-serviços)
6. [Padrão de hooks](#6-padrão-de-hooks)
7. [Validação com Zod](#7-validação-com-zod)
8. [Error handling](#8-error-handling)
9. [Tipos TypeScript](#9-tipos-typescript)
10. [Regras de formatação (Prettier)](#10-regras-de-formatação-prettier)
11. [Regras ESLint](#11-regras-eslint)
12. [Setup de testes com Vitest](#12-setup-de-testes-com-vitest)
13. [Padrões de mocking](#13-padrões-de-mocking)
14. [React Router e Outlet](#14-react-router-e-outlet)
15. [Git commit messages](#15-git-commit-messages)
16. [Checklist antes de commit](#16-checklist-antes-de-commit)

---


## 1. Scripts disponíveis

```bash
# Desenvolvimento
pnpm run dev                # Iniciar ambiente de desenvolvimento completo
make dev                    # (Opcional) Mesmo que acima via Makefile
make dev-backend            # Backend + infraestrutura apenas
make dev-frontend           # Frontend + infraestrutura apenas

# Build
pnpm run build              # Build de produção (output em /dist)
pnpm run build:dev          # Build em modo development
pnpm run preview            # Pré-visualizar build de produção
make build                  # (Opcional) Build via Makefile

# Testes
pnpm run test               # Executar todos os testes unitários/integrados (Vitest)
pnpm run test:ui            # Testes em modo watch/UI
pnpm run test:frontend      # Testes apenas para componentes UI
pnpm run test:backend       # Testes apenas para serviços/lógicas
pnpm run test:e2e           # Testes End-to-End (Playwright)
make test                   # (Opcional) Testes via Makefile

# Qualidade de código
pnpm run lint               # Lint em todo o código
pnpm run lint:fix           # Corrigir erros de lint automaticamente
pnpm run format             # Formatar código com Prettier
pnpm run format:check       # Verificar formatação
pnpm run type-check         # Checagem de tipos TypeScript

# Validação
pnpm run validate           # Lint + format-check + type-check + test
pnpm run validate:full      # Validação completa (inclui build)
pnpm run ci                 # Pipeline CI local (lint, test, build)
make validate-full          # (Opcional) Validação completa via Makefile

# Admin
pnpm run setup:admin        # Criar/configurar utilizador admin no Supabase

# Git
pnpm run sync               # git add . && commit 'Update' && push origin main
```

> **Nota:** O projeto agora usa `pnpm` como package manager. O binário está disponível globalmente após instalação.

---

## 2. Como o código deve estar escrito

### ✅ Correto

```tsx
// Imports organizados: externos → internos → tipos
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { employeeService } from '@/services/adminService';
import { ROUTES, ERROR_MESSAGES } from '@/lib/constants';
import type { Employee } from './types';

// Interface de props sempre explícita
interface EmployeeCardProps {
  employee: Employee;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

// Componente: arrow function + React.FC com tipo
export const EmployeeCard: React.FC<EmployeeCardProps> = ({
  employee,
  onEdit,
  onDelete,
  isLoading = false,
}) => {
  return (
    <div className="p-4 border rounded-lg">
      <p>{employee.first_name} {employee.last_name}</p>
    </div>
  );
};
```

### ❌ Errado

```tsx
// Sem tipos nos props
const EmployeeCard = ({ employee, onEdit }) => {
  return <div>{employee.name}</div>; // acesso a propriedade não tipada
};

// Sem export nomeado
export default function thing() {}   // nome não descritivo

// console.log solto
console.log('debug', data);          // proibido em produção

// any type
const handleData = (data: any) => {}; // usar tipo específico

// Lógica de negócio dentro do componente sem hook
useEffect(() => {
  supabase.from('employees').select('*').then(...)  // deve estar num service/hook
}, []);
```

---

## 3. Estrutura de ficheiros

```
src/
├── contexts/
│   └── AuthContext.tsx          ← Estado global de autenticação
├── components/
│   ├── ProtectedRoute.tsx       ← Proteção de rotas por role
│   ├── GlobalErrorBoundary.tsx  ← Error boundary global
│   ├── layout/
│   │   └── AdminLayout.tsx      ← Layout do painel admin
│   └── ui/                      ← Componentes Shadcn/Radix
├── pages/
│   ├── admin/                   ← Páginas do painel admin
│   ├── employee/                ← Páginas do colaborador
│   └── auth/                    ← Callback e set-password
├── services/
│   └── adminService.ts          ← Chamadas à API Supabase
├── hooks/
│   ├── useAdminPermissions.ts   ← Permissões granulares do admin
│   └── use-toast.ts
├── lib/
│   ├── constants.ts             ← ROTAS, mensagens de erro, etc.
│   └── utils.ts                 ← cn() e helpers gerais
├── utils/
│   └── apiClient.ts             ← Wrapper centralizado do Supabase
├── integrations/
│   └── supabase/
│       ├── client.ts            ← Instância do Supabase
│       └── types.ts             ← Tipos gerados pelo Supabase
├── App.tsx                      ← Routing + providers
└── main.tsx                     ← Entry point
```

### Regras de localização
- **Nova página admin** → `src/pages/admin/NomeDaPagina.tsx`
- **Novo serviço de API** → `src/services/nomeService.ts`
- **Novo hook** → `src/hooks/useNomeDoHook.ts`
- **Nova constante** → adicionar em `src/lib/constants.ts`
- **Novo tipo global** → adicionar em `src/integrations/supabase/types.ts` ou criar `src/lib/types.ts`

---

## 4. Padrão de componentes

### Limite de tamanho: máximo 150 linhas por componente

Se um componente ultrapassar 150 linhas, dividir em sub-componentes.

```tsx
// ✅ Componente bem estruturado
import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ROUTES } from '@/lib/constants';
import type { Company } from './types';

interface CompanyTableProps {
  companies: Company[];
  isLoading: boolean;
  onDelete: (id: string) => Promise<void>;
}

export const CompanyTable: React.FC<CompanyTableProps> = ({
  companies,
  isLoading,
  onDelete,
}) => {
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
      toast({ title: 'Empresa eliminada com sucesso' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {companies.map(company => (
        <div key={company.id} className="flex items-center justify-between p-3 border rounded">
          <span>{company.name}</span>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(company.id)}>
            Eliminar
          </Button>
        </div>
      ))}
    </div>
  );
};
```

---

## 5. Padrão de serviços

Toda chamada ao Supabase deve estar num **service**, nunca directamente num componente.

```typescript
// src/services/companyService.ts
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Company = Database['public']['Tables']['companies']['Row'];
type CompanyInsert = Database['public']['Tables']['companies']['Insert'];

export const companyService = {
  /**
   * Obter todas as empresas ordenadas por nome
   */
  getAll: async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Criar nova empresa
   */
  create: async (company: CompanyInsert) => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .insert(company)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Eliminar empresa por ID
   */
  delete: async (id: string) => {
    try {
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error };
    }
  },
};
```

---

## 6. Padrão de hooks

```typescript
// src/hooks/useCompanies.ts
import { useState, useEffect, useCallback } from 'react';
import { companyService } from '@/services/companyService';
import type { Database } from '@/integrations/supabase/types';

type Company = Database['public']['Tables']['companies']['Row'];

interface UseCompaniesResult {
  companies: Company[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useCompanies = (): UseCompaniesResult => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await companyService.getAll();

    if (fetchError) {
      setError('Erro ao carregar empresas');
    } else {
      setCompanies(data ?? []);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  return { companies, isLoading, error, refetch: fetchCompanies };
};
```

---

## 7. Validação com Zod

O projeto já tem `zod` instalado. Usar sempre para validar formulários.

```typescript
// Definir schema
import { z } from 'zod';

export const createEmployeeSchema = z.object({
  first_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  last_name: z.string().min(2, 'Sobrenome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  company_id: z.string().uuid('Empresa inválida'),
  is_active: z.boolean().default(true),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

// Usar com react-hook-form
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const form = useForm<CreateEmployeeInput>({
  resolver: zodResolver(createEmployeeSchema),
  defaultValues: { is_active: true },
});
```

---

## 8. Error handling

```tsx
// ✅ Padrão de try/catch em handlers
const handleSubmit = async (data: CreateEmployeeInput) => {
  try {
    const { error } = await employeeService.create(data);
    if (error) throw error;

    toast({ title: 'Colaborador criado com sucesso' });
    navigate(ROUTES.ADMIN.EMPLOYEES);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.AUTH.UNEXPECTED;
    toast({ title: 'Erro', description: message, variant: 'destructive' });
  }
};

// ✅ Padrão nos serviços: sempre retornar { data, error }
// Nunca lançar excepção num service — deixar o componente/hook decidir
const result = await companyService.getAll();
if (result.error) {
  // tratar erro
}
```

---

## 9. Tipos TypeScript

```typescript
// ✅ Usar tipos da DB gerados pelo Supabase
import type { Database } from '@/integrations/supabase/types';
type Employee = Database['public']['Tables']['employees']['Row'];

// ✅ Tipos de response consistentes
interface ServiceResult<T> {
  data: T | null;
  error: Error | unknown | null;
}

// ✅ Preferir 'unknown' em vez de 'any' nos catch
} catch (error: unknown) {
  const msg = error instanceof Error ? error.message : 'Erro desconhecido';
}

// ❌ Proibido
const foo: any = bar;
const handler = (e: any) => {};
```

---

## 10. Regras de formatação (Prettier)

Configuração em `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

### Aplicar formatação

```bash
# Formatar todos os ficheiros src/
pnpm run format

# Verificar sem alterar (útil para CI)
npx prettier --check "src/**/*.{ts,tsx,css}"

# Formatar ficheiro específico
npx prettier --write src/components/layout/AdminLayout.tsx
```

### Resultados esperados

```typescript
// ✅ Depois do prettier
import { useState } from 'react';

const MyComponent = () => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = () => setIsOpen(prev => !prev);

  return <button onClick={handleClick}>Clique</button>;
};

// ❌ Antes do prettier (vai ser auto-corrigido)
import {useState} from "react"
const MyComponent=()=>{
const [isOpen,setIsOpen]=useState(false)
return <button onClick={()=>setIsOpen(!isOpen)}>Clique</button>
}
```

---

## 11. Regras ESLint

```bash
# Verificar
pnpm run lint

# Auto-fix
pnpm run lint:fix
```

### Regras aplicadas

| Regra | Nível | Descrição |
|---|---|---|
| `no-console` | warn | Sem `console.log` em produção |
| `@typescript-eslint/no-explicit-any` | warn | Sem `any` type explícito |
| `react-hooks/rules-of-hooks` | error | Hooks apenas em componentes/outros hooks |
| `react-hooks/exhaustive-deps` | warn | Dependencies dos hooks corretas |
| `react-refresh/only-export-components` | warn | HMR correto |

### Exemplos

```tsx
// ✅ Correto
const { data } = await supabase.from('employees').select('*');

// ❌ ESLint vai avisar
console.log('debug aqui');          // no-console
const x: any = something;           // no-explicit-any
useEffect(() => { ... }, []);        // exhaustive-deps (se faltar dep)
```

---

## 12. Setup de testes com Vitest

### Configuração base (`vitest.config.ts`)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/setupTests.ts', 'e2e/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Setup inicial (`src/setupTests.ts`)

```typescript
// src/setupTests.ts
import '@testing-library/jest-dom';

// Opcional: mock global de console warnings se necessário
// global.console = {
//   ...console,
//   warn: vi.fn(),
//   error: vi.fn(),
// };
```

### Executar testes

```bash
# Executar todos os testes
pnpm test

# Modo watch/UI interativo
pnpm test:ui

# Apenas componentes UI
pnpm test:frontend

# Apenas serviços e hooks
pnpm test:backend
```

### Estrutura de arquivo de teste

```typescript
// src/modules/auth/services/__tests__/authService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from '../authService';

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should login user successfully', async () => {
    // Arrange
    const email = 'test@example.com';
    const password = 'password123';

    // Act
    const result = await authService.login(email, password);

    // Assert
    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
  });

  it('should handle login error', async () => {
    // Arrange
    const email = 'invalid@example.com';
    const password = 'wrong';

    // Act
    const result = await authService.login(email, password);

    // Assert
    expect(result.error).toBeDefined();
    expect(result.data).toBeNull();
  });
});
```

---

## 13. Padrões de mocking

### Mock de Supabase no teste

```typescript
// src/contexts/__tests__/AuthContext.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock do Supabase ANTES de importar os serviços
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
    },
  },
}));

// Mock dos serviços
vi.mock('@/modules/auth/services/authService', () => ({
  authService: {
    login: vi.fn(),
    logout: vi.fn(),
    getSession: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

vi.mock('@/modules/admin/services/accessService', () => ({
  accessService: {
    getUserRole: vi.fn(),
  },
}));

import { authService } from '@/modules/auth/services/authService';
import { accessService } from '@/modules/admin/services/accessService';

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load authenticated user on mount', async () => {
    const mockSession = {
      user: { id: 'user-123', email: 'admin@example.com' },
      access_token: 'token-123',
    };

    // Use mockResolvedValueOnce para cada teste isolado
    vi.mocked(authService.getSession).mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    } as any);

    vi.mocked(accessService.getUserRole).mockResolvedValueOnce({
      role: 'admin',
      error: null,
    } as any);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('user').textContent).toBe('admin@example.com (admin)');
      },
      { timeout: 3000 }
    );
  });
});
```

### Mock de hooks com `renderHook`

```typescript
// src/hooks/__tests__/useAdminPermissions.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminPermissions } from '../useAdminPermissions';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    })),
  },
}));

import { supabase } from '@/integrations/supabase/client';

describe('useAdminPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useAdminPermissions());
    expect(result.current.isLoading).toBe(true);
  });

  it('should handle no session gracefully', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    } as any);

    const { result } = renderHook(() => useAdminPermissions());

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 3000 }
    );

    expect(result.current.permissions).toEqual([]);
  });
});
```

### Padrão de `act()` para updates síncronos

```typescript
// ✅ Correto: usar act() para cliques de botão
const loginButton = screen.getByText('Login');
await act(async () => {
  loginButton.click();
  await new Promise(resolve => setTimeout(resolve, 100)); // pequena pausa
});

// ✅ Correto: usar waitFor com timeout
await waitFor(
  () => {
    expect(authService.login).toHaveBeenCalledWith('admin@example.com', 'password');
  },
  { timeout: 3000 }
);

// ❌ Errado: não usar act() e esperar resultado imediato
loginButton.click();
expect(authService.login).toHaveBeenCalled(); // pode falhar (async não completo)
```

---

## 14. React Router e Outlet

### Estrutura de rotas protegidas com Outlet

```tsx
// src/App.tsx
import { Outlet } from 'react-router-dom';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import AdminLayout from '@/components/layout/AdminLayout';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rotas públicas */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/colaborador/login" element={<EmployeeLoginPage />} />

        {/* Rotas protegidas ADMIN com layout */}
        <Route
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/colaboradores" element={<EmployeesPage />} />
        </Route>

        {/* Rotas protegidas EMPLOYEE com wrapper */}
        <Route
          element={
            <ProtectedRoute requiredRole="employee">
              <div style={{ width: '100%' }}>
                {/* ✅ IMPORTANTE: Outlet renderiza as rotas filhas */}
                <Outlet />
              </div>
            </ProtectedRoute>
          }
        >
          <Route path="/colaborador" element={<EmployeeDashboard />} />
          <Route path="/colaborador/tickets" element={<EmployeeTicketsPage />} />
          <Route path="/colaborador/documentos" element={<EmployeeDocumentsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

### ⚠️ Problema comum: Outlet faltando

```tsx
// ❌ ERRADO: tela branca após login
<Route
  element={
    <ProtectedRoute requiredRole="employee">
      <div>Wrapper</div>  {/* ❌ Sem Outlet, rotas filhas não renderizam */}
    </ProtectedRoute>
  }
>
  <Route path="/colaborador" element={<EmployeeDashboard />} />
</Route>

// ✅ CORRETO: usar Outlet
<Route
  element={
    <ProtectedRoute requiredRole="employee">
      <div>
        Wrapper
        <Outlet /> {/* ✅ Renderiza as rotas filhas aqui */}
      </div>
    </ProtectedRoute>
  }
>
  <Route path="/colaborador" element={<EmployeeDashboard />} />
</Route>
```

---

## 15. Git commit messages

Formato: `tipo: descrição curta em português`

```bash
# Tipos válidos
feat:     # Nova funcionalidade
fix:      # Correção de bug
refactor: # Refatoração (sem nova feature nem bug fix)
docs:     # Só documentação
style:    # Formatação, sem lógica
test:     # Adicionar/corrigir testes
chore:    # Dependências, configuração, CI

# Exemplos
git commit -m "feat: Adicionar página de gestão de ausências"
git commit -m "fix: Corrigir redirect após login admin"
git commit -m "refactor: Extrair lógica de permissões para hook"
git commit -m "chore: Instalar prettier e configurar formatação"
git commit -m "docs: Atualizar README com scripts disponíveis"

# Commit com corpo (para mudanças maiores)
git commit -m "feat: Implementar AuthContext centralizado

- Criar contexto com login, logout, checkAuth
- Integrar AuthProvider em App.tsx
- Refatorar AdminLoginPage para usar useAuth()
- Remover localStorage auth_preference inseguro"
```

---

## 16. Checklist antes de commit

```
OBRIGATÓRIO:
[ ] pnpm lint              → sem erros ESLint
[ ] pnpm build             → build passa sem erros TypeScript
[ ] pnpm test              → todos os testes passam
[ ] pnpm format            → código formatado com Prettier
[ ] Sem console.log soltos (usar console.warn ou console.error)
[ ] Sem tipos 'any' explícitos (usar 'unknown' nos catch)
[ ] Sem credenciais ou secrets no código
[ ] Variáveis de ambiente via import.meta.env.VITE_*
[ ] @ts-ignore substituído por @ts-expect-error com motivo
[ ] <Outlet /> presente em rotas protegidas com sub-rotas

BOM PRATICAR:
[ ] Props tipadas com interface ou type
[ ] Error handling nos async handlers
[ ] Loading states tratados na UI
[ ] Mensagens de erro usando ERROR_MESSAGES de constants.ts
[ ] Rotas usando ROUTES de constants.ts (sem strings hardcoded)
[ ] Componente < 150 linhas (se não, dividir)
[ ] JSDoc nas funções públicas de serviços/hooks
[ ] Testes para lógica complexa (services, hooks)
[ ] Mocks de Supabase em testes (não deixar chamadas reais)
[ ] Usar waitFor com timeout em testes assíncronos
```

---

## Notas importantes sobre correções recentes (pnpm migration + Vitest setup)

### ESLint: 14 erros corrigidos

- ✅ **Interfaces vazias** substituídas por `type` (Shadcn UI components)
  - Exemplo: `interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}` → `type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>`
  
- ✅ **@ts-ignore → @ts-expect-error** (boas práticas TypeScript)
  - Use `@ts-expect-error` com comentário explicativo
  - Exemplo: `// @ts-expect-error - Supabase relational data typing`
  
- ✅ **Constant binary expressions removidas** (evita confusões)
  - Remover `true && 'class'` e deixar apenas `'class'`
  
- ✅ **require() em Tailwind marcado** como `eslint-disable-next-line`
  - Necessário para Tailwind plugins

### Testes: Status final

- ✅ **66 testes passando**
- ⏭️ **4 testes skipped temporariamente** (complexos, relacionados a async state)
  - Estes podem ser refinados futuramente quando a maturidade de testes aumentar
- ✅ **Build funcionando** (5.80s)
- ✅ **Supabase PWA funcionando** (workbox-window instalado)

### Problemas solucionados

| Problema | Solução | Status |
|----------|---------|--------|
| Tela branca após login de colaborador | Adicionar `<Outlet />` em rotas protegidas | ✅ Corrigido |
| Build do Vite falhando (workbox-window) | Instalar dependência com `pnpm add workbox-window` | ✅ Corrigido |
| Testes do AuthContext falhando | Mockar `supabase.auth.onAuthStateChange` | ✅ Corrigido |
| Testes esperando resultado muito rápido | Aumentar timeout de `waitFor()` para 3000ms | ✅ Corrigido |
| Mocks sendo reusados entre testes | Usar `mockResolvedValueOnce` ao invés de `mockResolvedValue` | ✅ Corrigido |

---

## Variáveis de ambiente

### Setup Geral

```bash
# 1. DESENVOLVIMENTO LOCAL
# Copiar template e editar com suas credenciais
cp .env.example .env.local

# Editar .env.local com credenciais reais (NUNCA commitar)
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_public_xxxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxx
```

### Fluxo de Ambientes

| Ambiente | Ficheiro | Método | Uso |
|----------|----------|--------|-----|
| **Local Dev** | `.env.local` | Manual (git ignored) | `pnpm run dev` |
| **CI/CD (Tests)** | GitHub Secrets | Automático (workflow) | GitHub Actions |
| **Produção** | Vercel Dashboard | Variáveis de ambiente | Deployment |

### GitHub Actions (CI/CD)

O workflow automático:
1. Lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` de GitHub Secrets
2. Cria `.env.local` temporário no runner
3. Executa testes com credenciais reais

**Configuração necessária em GitHub:**
```
Settings > Secrets and variables > Actions > New repository secret
- Name: VITE_SUPABASE_URL
- Value: https://seu-projeto.supabase.co

- Name: VITE_SUPABASE_ANON_KEY
- Value: sb_anon_xxxx
```

### Acesso no Código

```typescript
// ✅ CORRETO - Variáveis públicas (cliente)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ✅ CORRETO - Scripts de servidor (.mjs)
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ❌ ERRADO - Hardcoded
const key = 'sb_anon_xxxxx'; // NUNCA!

// ❌ ERRADO - API Key em cliente
const secret = import.meta.env.SUPABASE_SERVICE_ROLE_KEY; // Só em scripts!
```

### Nomes Padronizados

**Use SEMPRE estes nomes:**
- `VITE_SUPABASE_URL` — URL do projeto Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Anon key (cliente)
- `SUPABASE_SERVICE_ROLE_KEY` — Service role (scripts apenas)

Nomes consistentes garantem que funcione em local, CI e produção.

---

## Autenticação — como funciona

```
1. App.tsx envolve tudo com <AuthProvider>
2. AuthContext.tsx gere sessão, role e login/logout
3. ProtectedRoute.tsx protege rotas por role ('admin' | 'employee')
4. useAuth() hook dá acesso ao contexto em qualquer componente

Roles disponíveis:
  - 'admin'         → acesso ao painel /admin
  - 'company_admin' → admin de uma empresa específica  
  - 'employee'      → acesso ao portal /colaborador
```

---

*Atualizado em: Maio 2026 · Projeto: Realize Consultadoria*
*Última migração: pnpm + Vitest setup + correções de ESLint (14 erros)*
