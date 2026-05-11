# Realize Consultadoria — Plataforma de Gestão de RH

**Stack:** React 18 + TypeScript + Vite + Supabase + Tailwind CSS  
**Package Manager:** pnpm  
**Testing:** Vitest + Playwright  
**Deployment:** Vercel (PWA)

---

## 🚀 Início Rápido

### Pré-requisitos

- **Node.js** 20+ (instale com [nvm](https://github.com/nvm-sh/nvm))
- **pnpm** 10+ (instale globalmente: `npm install -g pnpm`)

### Instalação e Desenvolvimento

```bash
# 1. Clone o repositório
git clone <YOUR_GIT_URL>
cd realizeconsultadoria

# 2. Instale dependências
pnpm install

# 3. Configure variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais Supabase

# 4. Inicie o servidor de desenvolvimento
pnpm run dev
```

Acesse http://localhost:5173

---

## 📦 Scripts Disponíveis

### Desenvolvimento
```bash
pnpm run dev              # Iniciar servidor Vite
pnpm run preview          # Pré-visualizar build de produção
```

### Build & Deploy
```bash
pnpm run build            # Build para produção (/dist)
pnpm run build:dev        # Build em modo development
```

### Testes
```bash
pnpm run test             # Todos os testes unitários/integrados (Vitest)
pnpm run test:ui          # Modo watch/UI interativo
pnpm run test:frontend    # Apenas testes de componentes
pnpm run test:backend     # Apenas testes de serviços/hooks
pnpm run test:e2e         # Testes End-to-End (Playwright)
```

### Qualidade de Código
```bash
pnpm run lint             # ESLint
pnpm run lint:fix         # ESLint com auto-fix
pnpm run format           # Prettier
pnpm run format:check     # Verificar formatação
pnpm run type-check       # TypeScript type checking
```

### Validação Completa
```bash
pnpm run validate         # lint + format-check + type-check + test
pnpm run validate:full    # Validação completa (inclui build)
pnpm run ci               # Pipeline CI local (lint, test, build)
```

### Administração
```bash
pnpm run setup:admin      # Criar/configurar utilizador admin no Supabase
```

---

## 🗂️ Estrutura do Projeto

```
src/
├── contexts/              # Estado global (AuthContext, etc)
├── components/
│   ├── ui/                # Componentes Shadcn/Radix (UI primitivos)
│   ├── layout/            # Layouts (AdminLayout, etc)
│   ├── admin/             # Componentes específicos do admin
│   ├── employee/          # Componentes específicos do colaborador
│   ├── landing/           # Página de landing
│   └── ProtectedRoute.tsx # Proteção de rotas por role
├── pages/                 # Páginas por role (admin/, employee/, auth/)
├── services/              # Chamadas ao Supabase + lógica
├── hooks/                 # Custom React hooks
├── lib/                   # Utilitários, constantes, types globais
├── integrations/
│   └── supabase/          # Cliente Supabase + tipos gerados
├── modules/               # Módulos por feature (se necessário)
└── App.tsx                # Routing principal + providers
```

Para detalhes completos, consulte [AGENTS.md](./AGENTS.md#3-estrutura-de-ficheiros)

---

## 🔐 Autenticação & Autorização

### Fluxo de Autenticação

1. **Utilizador faz login** via `AdminLoginPage` ou `EmployeeLoginPage`
2. **AuthContext verifica sessão** e carrega o role
3. **ProtectedRoute protege rotas** por role:
   - `admin` → acesso a `/admin`
   - `employee` → acesso a `/colaborador`

### Roles Disponíveis

```
- admin         → Painel administrativo completo
- company_admin → Admin de uma empresa específica
- employee      → Portal do colaborador
```

---

## 🧪 Testes

### Estrutura de Testes

```
src/
├── components/__tests__/      # Testes de componentes
├── hooks/__tests__/           # Testes de hooks
├── services/__tests__/        # Testes de serviços
└── contexts/__tests__/        # Testes de contextos

e2e/
├── login.spec.ts              # Testes End-to-End
```

### Exemplo de Teste

```typescript
// src/components/__tests__/Button.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('should render button text', () => {
    render(<Button>Clique</Button>);
    expect(screen.getByText('Clique')).toBeInTheDocument();
  });
});
```

Para padrões completos, consulte [AGENTS.md#setup-de-testes-com-vitest](./AGENTS.md#12-setup-de-testes-com-vitest)

---

## 📝 Padrões de Código

Este projeto segue padrões estritos documentados em [AGENTS.md](./AGENTS.md):

- ✅ TypeScript strict mode
- ✅ Componentes < 150 linhas
- ✅ Props tipadas com interfaces
- ✅ Error handling com try/catch
- ✅ Sem `console.log` em produção
- ✅ Sem `any` types (usar `unknown`)
- ✅ `@ts-expect-error` com comentários explicativos

### Commit Messages

Formato: `tipo: descrição curta em português`

```bash
git commit -m "feat: Adicionar página de gestão de ausências"
git commit -m "fix: Corrigir redirect após login admin"
git commit -m "chore: Instalar prettier e configurar formatação"
```

Tipos válidos: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`

---

## 🌍 Variáveis de Ambiente

```bash
# .env.local (NÃO commitar — está em .gitignore)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxx        # Apenas para scripts
```

Veja [.env.example](./.env.example) para template.

---

## 🚀 Deployment

### Vercel (Recomendado)

```bash
# 1. Push para main/develop
git push origin main

# 2. Vercel faz build automático
# 3. App disponível em https://seu-projeto.vercel.app
```

**Configuração automática:**
- Framework: Vite
- Build command: `pnpm run build`
- Output directory: `dist`

### Build Local

```bash
pnpm run build
# Output em: ./dist/
```

---

## 📚 Documentação

- **[AGENTS.md](./AGENTS.md)** — Guia completo de padrões e melhores práticas
- **[CODE_STANDARDS.md](./CODE_STANDARDS.md)** — Padrões de código detalhados
- **[START_HERE.md](./START_HERE.md)** — Guia para novos developers
- **[.github/workflows/ci.yml](./.github/workflows/ci.yml)** — Pipeline CI/CD

---

## 🤝 Contribuição

### Workflow de Contribuição

1. **Crie uma branch** para sua feature
   ```bash
   git checkout -b feat/minha-feature
   ```

2. **Desenvolva** seguindo os padrões em [AGENTS.md](./AGENTS.md)

3. **Valide antes de commitar**
   ```bash
   pnpm run validate:full
   ```

4. **Commit com mensagem descritiva**
   ```bash
   git commit -m "feat: Descrição da minha feature"
   ```

5. **Push e abra Pull Request**
   ```bash
   git push origin feat/minha-feature
   ```

### Checklist antes de PR

- [ ] `pnpm lint` → 0 erros
- [ ] `pnpm test` → todos passam
- [ ] `pnpm build` → sucesso
- [ ] `pnpm format` → código formatado
- [ ] Sem `console.log` solto
- [ ] Sem credenciais no código
- [ ] TypeScript types corretos
- [ ] Tests para lógica nova

---

## 🛠️ Tech Stack

| Categoria | Tecnologia | Versão |
|-----------|------------|--------|
| **Framework** | React | 18.3.1 |
| **Linguagem** | TypeScript | 5.8.3 |
| **Build** | Vite | 8.0.12 |
| **Database** | Supabase | 2.89.0 |
| **UI** | Shadcn/Radix | Latest |
| **Styling** | Tailwind CSS | 3.4.14 |
| **Testing** | Vitest | 4.1.5 |
| **E2E Testing** | Playwright | 1.59.1 |
| **Package Manager** | pnpm | 10.x |

---

## ❓ FAQ

### Posso usar `npm` em vez de `pnpm`?

Não recomendado. O projeto usa `pnpm-lock.yaml` e `pnpm-workspace.yaml`. Use `pnpm` para garantir dependências corretas.

### Como reset password de um utilizador?

```bash
# Script disponível no repositório
node scripts/setup-admin.mjs
```

### Como corrigir ESLint errors automaticamente?

```bash
pnpm run lint:fix
```

### Os testes estão falhando. O que fazer?

```bash
# 1. Limpe node_modules
rm -rf node_modules
pnpm install

# 2. Execute os testes novamente
pnpm test

# 3. Se persistir, consulte AGENTS.md#12-setup-de-testes-com-vitest
```

---

## 📞 Suporte

- **Documentação Interna:** [AGENTS.md](./AGENTS.md)
- **Issues:** [GitHub Issues](#)
- **Discussions:** [GitHub Discussions](#)

---

**Última atualização:** Maio 2026  
**Projeto:** Realize Consultadoria  
**Mantido por:** Equipa de Desenvolvimento
