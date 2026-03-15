# AutoApply — Arquitetura Frontend

> Documento vivo. Fonte da verdade para decisões arquiteturais do frontend.
> Complementar ao `BACKEND-ARCHITECTURE.md` — leia-o antes.
> Última atualização: 2026-03-03

---

## 1. Visão Geral

O frontend do AutoApply é um **SPA de dashboard e controle** para configurar perfis, buscar vagas, disparar candidaturas em lote e monitorar resultados em tempo real. Não é um site de conteúdo — não precisa de SSR, SEO nem server components.

### 1.1 Premissa

O frontend é **secundário** ao backend. O agente de automação funciona sem UI (via CLI ou API direta). A UI existe para:

1. Configurar o perfil do candidato
2. Buscar e filtrar vagas
3. Disparar e monitorar candidaturas
4. Visualizar dashboard de métricas
5. Gerenciar créditos e conta

O frontend **não contém lógica de negócio**. Toda regra vive no backend. O front consome a API REST, exibe dados e dispara ações.

### 1.2 Stack Definida

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Framework | React 19 | Ecossistema maduro, compatível com todas as libs escolhidas |
| Routing | TanStack Router | Type-safe, file-based routing, search params como first-class, code splitting automático |
| Bundler | Vite 6 | HMR rápido, plugin nativo do TanStack Router, build otimizado |
| Server State | TanStack Query v5 | Caching, background refetch, mutations, stale-while-revalidate |
| Client State | Zustand | Leve (1KB), sem providers, stores isolados por feature |
| Styling | Tailwind CSS v4 | Utility-first, tema dark nativo, zero CSS custom |
| Componentes | shadcn/ui | Acessível, composable, estilizado com Tailwind, customizável |
| Auth UI | Better Auth UI | Componentes prontos de login/signup compatíveis com Better Auth + shadcn/ui |
| Forms | React Hook Form + Zod | Validação type-safe, performance (uncontrolled), resolvers Zod |
| Tabelas | TanStack Table | Headless, sorting/filtering/pagination type-safe |
| HTTP Client | ky | Wrapper leve sobre fetch, retry nativo, hooks, interceptors |
| Testes | Vitest + Testing Library | Unitários para utils/hooks, integração para componentes |
| Visual Testing | Storybook 8 | Catálogo de componentes, visual regression (futuro) |
| Linting | ESLint + Prettier | Mesmo padrão do backend |
| Type Sharing | `@autoapply/shared` | Pacote do monorepo com DTOs, schemas Zod, enums |

### 1.3 Por que TanStack Router e não React Router?

Três motivos concretos para este projeto:

1. **Search params type-safe**: O dashboard de vagas vai ter filtros complexos na URL (plataforma, localização, salário, remoto, skills). TanStack Router trata search params como first-class citizens com validação Zod integrada. React Router trata como strings cruas.

2. **File-based routing com Vite plugin**: Rotas geradas automaticamente a partir da estrutura de pastas, com code splitting sem configuração. O Vite plugin gera o route tree com tipos completos.

3. **Loaders nativos com cache**: Cada rota pode declarar um `loader` que pré-carrega dados antes da renderização. Combinado com TanStack Query, elimina spinners desnecessários.

### 1.4 Por que NÃO Next.js?

- Não precisa de SSR (é um dashboard privado, não precisa de SEO)
- Não precisa de Server Components (toda lógica está no backend via API)
- App Router adiciona complexidade sem benefício para SPA puro
- Vite é significativamente mais rápido em dev (HMR instantâneo)
- Evita acoplamento framework ↔ deploy (Next.js praticamente exige Vercel para features completas)

---

## 2. Separação de Estado

Regra fundamental que guia toda a arquitetura:

> **Nunca armazenar dados do servidor em estado do cliente.**

TanStack Query cuida de cache, refetch e invalidação. Duplicar em Zustand cria bugs de sincronização.

### 2.1 Mapa de Responsabilidades

| Tipo de Estado | Ferramenta | Exemplos |
|----------------|-----------|----------|
| **Server state** | TanStack Query | Lista de vagas, candidaturas, perfil, créditos, dashboard stats |
| **Client state** | Zustand | Sidebar aberta/fechada, filtros do modal, tema, preferências UI |
| **URL state** | TanStack Router search params | Filtros de busca, paginação, tab ativa, sort order |
| **Form state** | React Hook Form | Dados do formulário de perfil, campos de busca |
| **Ephemeral state** | `useState` local | Tooltip visível, dropdown aberto, hover state |

### 2.2 Quando usar Zustand

Zustand **só** é necessário quando o estado:

1. Precisa ser compartilhado entre componentes **não-relacionados** na árvore
2. NÃO vem do servidor
3. NÃO faz sentido na URL
4. Persiste enquanto o SPA está aberto (não reseta na navegação)

Exemplos concretos neste projeto:

```typescript
// stores/ui.store.ts — Estado de UI global
interface UIStore {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

// stores/application-monitor.store.ts — Monitoramento em tempo real
interface ApplicationMonitorStore {
  liveUpdates: boolean;
  pollingInterval: number;
  setPollingInterval: (ms: number) => void;
  toggleLiveUpdates: () => void;
}
```

Não usar Zustand para: dados de vagas, perfil do usuário, histórico de candidaturas, saldo de créditos. Tudo isso é server state → TanStack Query.

---

## 3. Estrutura de Diretórios

### 3.1 Feature-Based Architecture

O frontend usa **feature-based architecture** (não layer-based). Cada feature é autossuficiente: seus componentes, hooks, tipos e testes vivem juntos.

```
packages/frontend/
├── src/
│   ├── app/                              # Bootstrap e providers
│   │   ├── main.tsx                      # Entry point
│   │   ├── router.tsx                    # TanStack Router config
│   │   ├── providers.tsx                 # QueryClient, AuthProvider, ThemeProvider
│   │   └── global.css                    # Tailwind imports + CSS variables
│   │
│   ├── routes/                           # File-based routing (TanStack Router)
│   │   ├── __root.tsx                    # Root layout (sidebar + topbar)
│   │   ├── index.tsx                     # / → redirect para /dashboard
│   │   ├── _auth.tsx                     # Layout para rotas de auth (sem sidebar)
│   │   ├── _auth/
│   │   │   ├── login.tsx
│   │   │   ├── register.tsx
│   │   │   └── forgot-password.tsx
│   │   ├── _app.tsx                      # Layout para rotas autenticadas (com sidebar)
│   │   ├── _app/
│   │   │   ├── dashboard.tsx             # /dashboard
│   │   │   ├── jobs/
│   │   │   │   ├── index.tsx             # /jobs (busca de vagas)
│   │   │   │   └── $jobId.tsx            # /jobs/:jobId (detalhes)
│   │   │   ├── applications/
│   │   │   │   ├── index.tsx             # /applications (lista)
│   │   │   │   └── $applicationId.tsx    # /applications/:id (detalhes + logs)
│   │   │   ├── profile.tsx               # /profile (configuração do perfil)
│   │   │   ├── credits.tsx               # /credits (saldo + histórico)
│   │   │   └── settings.tsx              # /settings
│   │
│   ├── features/                         # Feature modules (lógica de domínio UI)
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   └── AuthGuard.tsx         # Redirect se não autenticado
│   │   │   ├── hooks/
│   │   │   │   └── useAuth.ts            # Wrapper Better Auth client
│   │   │   └── lib/
│   │   │       └── auth-client.ts        # Better Auth client config
│   │   │
│   │   ├── jobs/
│   │   │   ├── components/
│   │   │   │   ├── JobSearchForm.tsx      # Form de busca com filtros
│   │   │   │   ├── JobCard.tsx            # Card de vaga
│   │   │   │   ├── JobList.tsx            # Grid/list de vagas
│   │   │   │   ├── JobFilters.tsx         # Sidebar de filtros
│   │   │   │   └── JobDetail.tsx          # Detalhes completos da vaga
│   │   │   ├── hooks/
│   │   │   │   ├── useJobSearch.ts        # TanStack Query: busca de vagas
│   │   │   │   ├── useJobDetail.ts        # TanStack Query: detalhes
│   │   │   │   └── useJobFilters.ts       # Lógica de filtros (search params)
│   │   │   ├── types/
│   │   │   │   └── index.ts              # Re-export de @autoapply/shared
│   │   │   └── utils/
│   │   │       └── format-salary.ts       # Formatação de salário
│   │   │
│   │   ├── applications/
│   │   │   ├── components/
│   │   │   │   ├── ApplicationTable.tsx   # Tabela com TanStack Table
│   │   │   │   ├── ApplicationStatus.tsx  # Badge de status com cores
│   │   │   │   ├── BatchApplyDialog.tsx   # Modal de candidatura em lote
│   │   │   │   ├── ApplicationLogs.tsx    # Timeline de tentativas/retries
│   │   │   │   └── ApplicationStats.tsx   # Métricas do batch
│   │   │   ├── hooks/
│   │   │   │   ├── useApplications.ts     # TanStack Query: lista
│   │   │   │   ├── useApplyToJob.ts       # TanStack Query: mutation
│   │   │   │   ├── useBatchApply.ts       # TanStack Query: batch mutation
│   │   │   │   └── useApplicationPolling.ts # Polling de status em tempo real
│   │   │   └── utils/
│   │   │       └── status-colors.ts       # Mapa status → cor/ícone
│   │   │
│   │   ├── profile/
│   │   │   ├── components/
│   │   │   │   ├── ProfileForm.tsx        # Form multi-step do perfil
│   │   │   │   ├── ResumeUpload.tsx       # Upload + preview de currículo
│   │   │   │   ├── SkillsInput.tsx        # Tag input de skills
│   │   │   │   └── CompletenessBar.tsx    # Barra de completude do perfil
│   │   │   └── hooks/
│   │   │       ├── useProfile.ts          # TanStack Query: perfil
│   │   │       └── useResumeUpload.ts     # Mutation de upload
│   │   │
│   │   ├── credits/
│   │   │   ├── components/
│   │   │   │   ├── CreditBalance.tsx      # Card de saldo
│   │   │   │   ├── TransactionHistory.tsx # Tabela de transações
│   │   │   │   └── PlanComparison.tsx     # Comparação de planos
│   │   │   └── hooks/
│   │   │       └── useCredits.ts          # TanStack Query: saldo + histórico
│   │   │
│   │   └── dashboard/
│   │       ├── components/
│   │       │   ├── StatsOverview.tsx       # Cards de métricas
│   │       │   ├── ApplicationChart.tsx    # Gráfico de candidaturas ao longo do tempo
│   │       │   ├── SuccessRateChart.tsx    # Taxa de sucesso por plataforma
│   │       │   ├── RecentActivity.tsx      # Timeline de atividades recentes
│   │       │   └── PlatformBreakdown.tsx   # Distribuição por plataforma
│   │       ├── hooks/
│   │       │   └── useDashboardStats.ts   # TanStack Query: stats
│   │       └── utils/
│   │           └── chart-config.ts        # Configuração dos gráficos Recharts
│   │
│   ├── components/                        # Componentes compartilhados (UI primitivos)
│   │   ├── ui/                            # shadcn/ui (gerado pelo CLI)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx                # Sidebar navegação principal
│   │   │   ├── Topbar.tsx                 # Header com user button + créditos
│   │   │   ├── PageHeader.tsx             # Título + breadcrumbs da página
│   │   │   └── ErrorBoundary.tsx          # Fallback de erro global
│   │   └── shared/
│   │       ├── DataTable.tsx              # Wrapper TanStack Table + shadcn
│   │       ├── EmptyState.tsx             # Estado vazio padrão
│   │       ├── LoadingSkeleton.tsx         # Skeleton padrão por tipo
│   │       ├── ConfirmDialog.tsx           # Dialog de confirmação reutilizável
│   │       └── PlatformIcon.tsx            # Ícone da plataforma (Indeed/LinkedIn)
│   │
│   ├── lib/                               # Utilitários e configurações
│   │   ├── api/
│   │   │   ├── client.ts                  # ky instance configurada (base URL, auth header)
│   │   │   ├── endpoints.ts               # Funções tipadas por endpoint
│   │   │   └── types.ts                   # Re-export de @autoapply/shared
│   │   ├── query/
│   │   │   ├── client.ts                  # QueryClient config
│   │   │   └── keys.ts                    # Query key factory
│   │   ├── stores/
│   │   │   ├── ui.store.ts                # Estado de UI global
│   │   │   └── monitor.store.ts           # Config de polling/monitoramento
│   │   └── utils/
│   │       ├── cn.ts                      # clsx + tailwind-merge
│   │       ├── format.ts                  # Formatação de datas, moeda, etc.
│   │       └── constants.ts               # Constantes da UI
│   │
│   └── styles/
│       └── tokens.css                     # CSS variables de design tokens
│
├── public/
│   └── favicon.svg
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── .storybook/
│   ├── main.ts
│   └── preview.ts
├── components.json                        # shadcn/ui config
└── package.json
```

### 3.2 Decisões de Estrutura

**Por que feature-based e não layer-based?**

Layer-based (`components/`, `hooks/`, `services/`, `types/`) não escala. Quando você tem 40+ componentes, encontrar o que pertence a "jobs" vs "applications" vira arqueologia. Feature-based mantém co-localização: tudo relacionado a vagas está em `features/jobs/`.

**Por que `routes/` separado de `features/`?**

Rotas são **thin layers**. Elas:
- Declaram search params (com validação Zod)
- Chamam loaders (que usam hooks de `features/`)
- Compõem componentes de `features/`
- Definem error/pending boundaries

Não contêm lógica nem markup complexo. A rota `/jobs` importa `JobSearchForm`, `JobList`, `JobFilters` de `features/jobs/` e os compõe no layout.

**Por que `components/ui/` separado?**

A pasta `components/ui/` é gerada pelo CLI do shadcn/ui (`npx shadcn add button`). Não devemos editar esses arquivos diretamente — se precisar customizar, criamos um wrapper em `components/shared/` ou na feature.

---

## 4. Routing (TanStack Router)

### 4.1 Configuração

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/app/routeTree.gen.ts',
      autoCodeSplitting: true,  // Code split automático por rota
    }),
    react(),
  ],
  resolve: {
    alias: { '@': '/src' },
  },
});
```

### 4.2 Layouts

Dois layouts principais usando pathless layout routes do TanStack Router:

```
_auth.tsx        → Layout sem sidebar (login, register, forgot-password)
_app.tsx         → Layout com sidebar + topbar (rotas autenticadas)
```

```typescript
// routes/_app.tsx
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    // Redirect se não autenticado
    if (!context.auth.session) {
      throw redirect({ to: '/login' });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex h-screen bg-zinc-950">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

### 4.3 Search Params Type-Safe

O grande diferencial para a tela de busca de vagas:

```typescript
// routes/_app/jobs/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { fallback } from '@tanstack/zod-adapter';

const jobSearchSchema = z.object({
  q: fallback(z.string(), ''),
  platform: fallback(z.enum(['indeed', 'linkedin', 'all']), 'all'),
  location: fallback(z.string(), ''),
  remote: fallback(z.boolean(), false),
  salaryMin: fallback(z.number().optional(), undefined),
  salaryMax: fallback(z.number().optional(), undefined),
  page: fallback(z.number().int().positive(), 1),
  sort: fallback(z.enum(['relevance', 'date', 'salary']), 'relevance'),
});

export const Route = createFileRoute('/_app/jobs/')({
  validateSearch: jobSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    // Prefetch via TanStack Query
    await context.queryClient.ensureQueryData(
      jobSearchQueryOptions(deps)
    );
  },
  component: JobsPage,
});

function JobsPage() {
  // Search params são tipados automaticamente
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  // Atualizar filtros = atualizar URL
  const updateFilters = (updates: Partial<typeof search>) => {
    navigate({ search: (prev) => ({ ...prev, ...updates, page: 1 }) });
  };

  return (
    <>
      <JobSearchForm search={search} onUpdate={updateFilters} />
      <JobFilters search={search} onUpdate={updateFilters} />
      <JobList search={search} />
    </>
  );
}
```

Isso significa:
- Filtros são persistidos na URL (compartilhável, botão voltar funciona)
- Zod valida na entrada (URL inválida recebe fallback, não crasheia)
- TypeScript infere todos os tipos automaticamente
- Loader pre-fetcha os dados antes do componente montar

### 4.4 Mapa de Rotas

```
/                            → Redirect → /dashboard
/login                       → Login (Better Auth UI)
/register                    → Registro (Better Auth UI)
/forgot-password             → Reset de senha

/dashboard                   → Stats, gráficos, atividade recente
/jobs                        → Busca de vagas (filtros na URL)
/jobs/:jobId                 → Detalhes da vaga + botão "Aplicar"
/applications                → Lista de candidaturas (filtros, paginação)
/applications/:applicationId → Detalhes + logs de tentativas
/profile                     → Configuração do perfil + upload currículo
/credits                     → Saldo, histórico, planos
/settings                    → Preferências, API key, tema
```

---

## 5. Data Fetching (TanStack Query)

### 5.1 Query Client Config

```typescript
// lib/query/client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,        // 5 min — dados "frescos"
      gcTime: 1000 * 60 * 30,           // 30 min — garbage collection
      retry: 2,                          // 2 retries em falha
      refetchOnWindowFocus: true,        // Refetch ao voltar para a aba
      refetchOnReconnect: true,          // Refetch ao reconectar
    },
    mutations: {
      retry: 1,
    },
  },
});
```

### 5.2 Query Key Factory

Organização centralizada de query keys para evitar inconsistência e facilitar invalidação:

```typescript
// lib/query/keys.ts
export const queryKeys = {
  // Jobs
  jobs: {
    all: ['jobs'] as const,
    search: (params: SearchParams) => ['jobs', 'search', params] as const,
    detail: (id: string) => ['jobs', 'detail', id] as const,
    analyze: (id: string) => ['jobs', 'analyze', id] as const,
  },

  // Applications
  applications: {
    all: ['applications'] as const,
    list: (filters: ApplicationFilters) => ['applications', 'list', filters] as const,
    detail: (id: string) => ['applications', 'detail', id] as const,
    logs: (id: string) => ['applications', 'logs', id] as const,
    batch: (batchId: string) => ['applications', 'batch', batchId] as const,
  },

  // Profile
  profile: {
    me: ['profile', 'me'] as const,
    completeness: ['profile', 'completeness'] as const,
  },

  // Credits
  credits: {
    balance: ['credits', 'balance'] as const,
    transactions: (params?: PaginationParams) =>
      ['credits', 'transactions', params] as const,
  },

  // Dashboard
  dashboard: {
    stats: ['dashboard', 'stats'] as const,
    activity: ['dashboard', 'activity'] as const,
  },
} as const;
```

### 5.3 Pattern: Query Options Factory

Em vez de espalhar `useQuery` com configs inline, centralizamos em "query options" reutilizáveis. Isso permite que loaders de rota e componentes usem a mesma query:

```typescript
// features/jobs/hooks/useJobSearch.ts
import { queryOptions, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import type { SearchParams, JobListResponse } from '@autoapply/shared';

// Query options — reutilizável em loaders e componentes
export function jobSearchQueryOptions(params: SearchParams) {
  return queryOptions({
    queryKey: queryKeys.jobs.search(params),
    queryFn: () => api.get('jobs/search', { searchParams: params }).json<JobListResponse>(),
    staleTime: 1000 * 60 * 2,  // Vagas mudam rápido, 2 min
    placeholderData: (previousData) => previousData,  // Mantém dados anteriores durante refetch
  });
}

// Hook — usado nos componentes
export function useJobSearch(params: SearchParams) {
  return useQuery(jobSearchQueryOptions(params));
}
```

### 5.4 Pattern: Mutations com Invalidação

```typescript
// features/applications/hooks/useBatchApply.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import type { BatchApplyInput, BatchApplyResponse } from '@autoapply/shared';

export function useBatchApply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BatchApplyInput) =>
      api.post('applications/batch', { json: input }).json<BatchApplyResponse>(),

    onSuccess: () => {
      // Invalida lista de candidaturas (vai refetchar)
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
      // Invalida saldo de créditos (foi debitado)
      queryClient.invalidateQueries({ queryKey: queryKeys.credits.balance });
      // Invalida dashboard stats
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats });
    },

    onError: (error) => {
      // Error handling centralizado (toast via Sonner)
    },
  });
}
```

### 5.5 Polling para Monitoramento Real-Time

Candidaturas em andamento precisam de status atualizado. Para o MVP, polling é suficiente (SSE/WebSocket é otimização futura):

```typescript
// features/applications/hooks/useApplicationPolling.ts
export function useApplicationPolling(applicationId: string) {
  const monitorStore = useMonitorStore();

  return useQuery({
    queryKey: queryKeys.applications.detail(applicationId),
    queryFn: () => api.get(`applications/${applicationId}`).json(),
    refetchInterval: monitorStore.liveUpdates
      ? monitorStore.pollingInterval  // Configurável pelo usuário (default: 5s)
      : false,                         // Para polling quando desligado
    refetchIntervalInBackground: false, // Não pollar em tab inativa
  });
}
```

---

## 6. HTTP Client

### 6.1 Por que `ky` e não `axios`?

- **Bundle size**: ky ~3KB vs axios ~13KB
- **Nativo**: Wrapper sobre `fetch`, não XMLHttpRequest
- **Retry nativo**: `retry: { limit: 2, statusCodes: [408, 413, 429, 500, 502, 503, 504] }`
- **Hooks**: `beforeRequest`, `afterResponse` para interceptors
- **Prefixo de URL**: Sem manipulação manual de base URL

### 6.2 Configuração

```typescript
// lib/api/client.ts
import ky from 'ky';
import { authClient } from '@/features/auth/lib/auth-client';

export const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 30_000,
  retry: {
    limit: 2,
    statusCodes: [408, 500, 502, 503, 504],
    methods: ['get'],  // Só retry em GETs (mutations não)
  },
  hooks: {
    beforeRequest: [
      async (request) => {
        // Injeta session token do Better Auth
        const session = await authClient.getSession();
        if (session?.token) {
          request.headers.set('Authorization', `Bearer ${session.token}`);
        }
      },
    ],
    afterResponse: [
      async (_request, _options, response) => {
        if (response.status === 401) {
          // Token expirado → redirect para login
          authClient.signOut();
          window.location.href = '/login';
        }
      },
    ],
  },
});
```

### 6.3 Endpoints Tipados

```typescript
// lib/api/endpoints.ts
import { api } from './client';
import type {
  JobListResponse, SearchParams,
  ApplicationListResponse, ApplicationFilters,
  UserProfile, CreditBalance,
  DashboardStats, BatchApplyInput, BatchApplyResponse,
} from '@autoapply/shared';

export const jobsApi = {
  search: (params: SearchParams) =>
    api.get('jobs/search', { searchParams: params as any }).json<JobListResponse>(),
  detail: (id: string) =>
    api.get(`jobs/${id}`).json<{ success: true; data: JobListing }>(),
  analyze: (id: string) =>
    api.post(`jobs/${id}/analyze`).json(),
};

export const applicationsApi = {
  list: (filters: ApplicationFilters) =>
    api.get('applications', { searchParams: filters as any }).json<ApplicationListResponse>(),
  batch: (input: BatchApplyInput) =>
    api.post('applications/batch', { json: input }).json<BatchApplyResponse>(),
  cancel: (id: string) =>
    api.delete(`applications/${id}`).json(),
};

export const profileApi = {
  get: () => api.get('profile').json<{ success: true; data: UserProfile }>(),
  update: (data: Partial<UserProfile>) =>
    api.put('profile', { json: data }).json(),
  uploadResume: (file: File) => {
    const formData = new FormData();
    formData.append('resume', file);
    return api.post('profile/resume', { body: formData }).json();
  },
};

export const creditsApi = {
  balance: () => api.get('credits').json<{ success: true; data: CreditBalance }>(),
  transactions: (params?: PaginationParams) =>
    api.get('credits/transactions', { searchParams: params as any }).json(),
};

export const dashboardApi = {
  stats: () => api.get('dashboard/stats').json<{ success: true; data: DashboardStats }>(),
  activity: () => api.get('dashboard/activity').json(),
};
```

---

## 7. Auth (Better Auth Client)

### 7.1 Client Config

```typescript
// features/auth/lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

// Hooks exportados
export const {
  useSession,
  signIn,
  signUp,
  signOut,
} = authClient;
```

### 7.2 Auth Guard

```typescript
// features/auth/components/AuthGuard.tsx
import { useSession } from '../lib/auth-client';
import { Navigate } from '@tanstack/react-router';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();

  if (isPending) return <LoadingSkeleton type="page" />;
  if (!session) return <Navigate to="/login" />;

  return <>{children}</>;
}
```

### 7.3 Better Auth UI Components

Para as telas de auth, usamos o pacote `@daveyplate/better-auth-ui` que fornece componentes prontos estilizados com shadcn/ui:

```typescript
// routes/_auth/login.tsx
import { createFileRoute } from '@tanstack/react-router';
import { SignIn } from '@daveyplate/better-auth-ui';

export const Route = createFileRoute('/_auth/login')({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <SignIn
        redirectTo="/dashboard"
        socialProviders={['google', 'github']}
      />
    </div>
  );
}
```

---

## 8. Design System

### 8.1 Princípios Visuais

O requisito é **empresarial, minimalista, cores escuras**. Traduzindo para decisões concretas:

| Princípio | Implementação |
|-----------|---------------|
| Dark-first | Tema dark como default, light como opção |
| Minimalista | Máximo 2 cores de destaque, espaçamento generoso |
| Empresarial | Tipografia limpa, sem ilustrações excessivas, dados-first |
| Contraste | Texto sobre dark: zinc-100 sobre zinc-950. Ações primárias: destaque claro |
| Densidade | Dashboard denso (muita informação visível), formulários espaçados |

### 8.2 Design Tokens (CSS Variables)

```css
/* styles/tokens.css */
@layer base {
  :root {
    /* Modo escuro como padrão */
    --background: 240 10% 3.9%;         /* zinc-950 */
    --foreground: 0 0% 98%;              /* zinc-50 */

    --card: 240 10% 5.9%;               /* zinc-900 */
    --card-foreground: 0 0% 98%;

    --primary: 210 100% 52%;             /* Azul profissional */
    --primary-foreground: 0 0% 100%;

    --secondary: 240 5.9% 10%;           /* zinc-800 */
    --secondary-foreground: 0 0% 98%;

    --muted: 240 3.7% 15.9%;            /* zinc-700-ish */
    --muted-foreground: 240 5% 64.9%;

    --accent: 142 76% 36%;              /* Verde para sucesso */
    --destructive: 0 84.2% 60.2%;       /* Vermelho para erros */
    --warning: 38 92% 50%;              /* Âmbar para warnings */

    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 210 100% 52%;

    --radius: 0.5rem;
  }

  .light {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    /* ... demais overrides */
  }
}
```

### 8.3 Paleta de Status

Cores consistentes para status de candidatura em toda a UI:

```typescript
// features/applications/utils/status-colors.ts
import type { ApplicationStatus } from '@autoapply/shared';

export const statusConfig: Record<ApplicationStatus, {
  label: string;
  color: string;        // Tailwind class para o Badge
  icon: string;         // Lucide icon name
}> = {
  QUEUED:    { label: 'Na fila',      color: 'bg-zinc-700 text-zinc-200',     icon: 'Clock' },
  APPLYING:  { label: 'Aplicando',    color: 'bg-blue-900 text-blue-200',     icon: 'Loader2' },
  SUBMITTED: { label: 'Enviado',      color: 'bg-emerald-900 text-emerald-200', icon: 'Check' },
  FAILED:    { label: 'Falhou',       color: 'bg-red-900 text-red-200',       icon: 'X' },
  RETRYING:  { label: 'Tentando...',  color: 'bg-amber-900 text-amber-200',   icon: 'RefreshCw' },
  EXHAUSTED: { label: 'Esgotado',     color: 'bg-red-950 text-red-300',       icon: 'AlertTriangle' },
};
```

### 8.4 Componentes shadcn/ui Necessários

Lista mínima para o MVP (instalar via CLI):

```bash
npx shadcn add button card dialog input select table badge
npx shadcn add toast tabs separator skeleton avatar dropdown-menu
npx shadcn add form label textarea command popover tooltip
npx shadcn add sheet scroll-area progress alert sonner
```

---

## 9. Telas Principais (Wireframe Funcional)

### 9.1 Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  Dashboard                          [Credits: 7] │
│            │                                                   │
│  🏠 Dash   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐│
│  🔍 Vagas  │  │ Aplicadas │ │ Sucesso  │ │ Pendentes│ │ Falha││
│  📋 Candid │  │    47     │ │   38     │ │    4     │ │  5   ││
│  👤 Perfil │  │  +12 mês  │ │  80.8%   │ │  na fila │ │ 10.6%││
│  💰 Crédit │  └──────────┘ └──────────┘ └──────────┘ └──────┘│
│  ⚙ Config  │                                                   │
│            │  ┌────────────────────┐ ┌──────────────────────┐  │
│            │  │ Candidaturas/Tempo │ │ Taxa por Plataforma  │  │
│            │  │  [Gráfico linha]   │ │   [Gráfico barras]   │  │
│            │  │                    │ │  Indeed: 85%         │  │
│            │  │                    │ │  LinkedIn: 72%       │  │
│            │  └────────────────────┘ └──────────────────────┘  │
│            │                                                   │
│            │  Atividade Recente                                 │
│            │  ● 14:32 — Candidatura enviada: "Sr React Dev"    │
│            │  ● 14:28 — Falha retry 3/5: "Full Stack Node"     │
│            │  ● 14:15 — 5 vagas encontradas: "React Remote"    │
└──────────────────────────────────────────────────────────────┘
```

### 9.2 Busca de Vagas

```
┌──────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  Vagas                               [Credits: 7]│
│            │                                                   │
│            │  ┌──────────────────────────────────────────────┐ │
│            │  │ 🔍 "React Developer"  📍 "Remote"  [Buscar] │ │
│            │  └──────────────────────────────────────────────┘ │
│            │                                                   │
│            │  Filtros:  [Indeed ✓] [LinkedIn ✓]  [Remoto ✓]   │
│            │            Salário: [R$ 8k] — [R$ 20k]           │
│            │            Ordenar: [Relevância ▼]                │
│            │                                                   │
│            │  23 vagas encontradas          [Selecionar Todas] │
│            │                                                   │
│            │  ┌────────────────────────────────────────────┐   │
│            │  │ ☐ Sr React Developer         Indeed       │   │
│            │  │   TechCorp • Remote • R$ 12k-18k          │   │
│            │  │   React, TypeScript, Node.js    [Ver ▶]   │   │
│            │  ├────────────────────────────────────────────┤   │
│            │  │ ☐ Full Stack Engineer         LinkedIn     │   │
│            │  │   StartupXYZ • São Paulo • R$ 15k-22k     │   │
│            │  │   React, Python, AWS            [Ver ▶]   │   │
│            │  └────────────────────────────────────────────┘   │
│            │                                                   │
│            │  [Aplicar em 5 selecionadas] (custo: 5 créditos) │
│            │  ◀ 1  2  3 ▶                                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. Testing Strategy (Frontend)

### 10.1 O Que Testar

| Tipo | Ferramenta | O que | Exemplos |
|------|-----------|-------|----------|
| **Unit** | Vitest | Utils, formatters, pure functions | `formatSalary()`, `statusConfig`, query key factory |
| **Hook** | Vitest + renderHook | Custom hooks com mocks | `useJobSearch` retorna dados mockados, `useBatchApply` invalida queries |
| **Component** | Vitest + Testing Library | Interação e renderização | `JobCard` exibe dados corretos, `BatchApplyDialog` valida créditos |
| **Visual** | Storybook | Catálogo + visual regression | Todos os componentes de `components/ui/` e `components/shared/` |
| **E2E** | Playwright (futuro) | Fluxos críticos | Login → Buscar → Selecionar → Aplicar → Verificar status |

### 10.2 Mocking da API (MSW)

Para testes de componente que dependem de dados do servidor, usamos Mock Service Worker (MSW) para interceptar requests no nível de rede:

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('*/api/jobs/search', () => {
    return HttpResponse.json({
      success: true,
      data: [mockJob1, mockJob2],
      meta: { page: 1, perPage: 20, total: 2 },
    });
  }),

  http.get('*/api/credits', () => {
    return HttpResponse.json({
      success: true,
      data: { available: 10, reserved: 2, plan: 'FREE' },
    });
  }),

  http.post('*/api/applications/batch', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: { batchId: 'batch-123', queued: body.jobIds.length },
    });
  }),
];
```

### 10.3 Funções Mockadas para Testes de Cálculo

Como você mencionou — funções de cálculo do dashboard que precisam de TDD com mocks do JSON do backend:

```typescript
// features/dashboard/utils/calculate-stats.ts
import type { DashboardStats } from '@autoapply/shared';

export function calculateSuccessRate(stats: DashboardStats): number {
  if (stats.totalApplications === 0) return 0;
  return (stats.successfulApplications / stats.totalApplications) * 100;
}

export function calculateCreditBurnRate(stats: DashboardStats): {
  dailyAverage: number;
  daysRemaining: number;
} {
  const days = stats.activeDays || 1;
  const dailyAverage = stats.creditsUsed / days;
  const daysRemaining = dailyAverage > 0
    ? Math.floor(stats.creditsAvailable / dailyAverage)
    : Infinity;

  return { dailyAverage, daysRemaining };
}

// features/dashboard/utils/calculate-stats.test.ts
import { describe, it, expect } from 'vitest';
import { calculateSuccessRate, calculateCreditBurnRate } from './calculate-stats';

describe('calculateSuccessRate', () => {
  it('returns 0 when no applications', () => {
    expect(calculateSuccessRate({ totalApplications: 0, successfulApplications: 0 })).toBe(0);
  });

  it('calculates correct percentage', () => {
    expect(calculateSuccessRate({ totalApplications: 50, successfulApplications: 40 })).toBe(80);
  });
});

describe('calculateCreditBurnRate', () => {
  it('returns Infinity days remaining when no usage', () => {
    const result = calculateCreditBurnRate({
      creditsUsed: 0,
      creditsAvailable: 10,
      activeDays: 5,
    });
    expect(result.daysRemaining).toBe(Infinity);
  });

  it('calculates daily average and days remaining', () => {
    const result = calculateCreditBurnRate({
      creditsUsed: 20,
      creditsAvailable: 30,
      activeDays: 10,
    });
    expect(result.dailyAverage).toBe(2);
    expect(result.daysRemaining).toBe(15);
  });
});
```

### 10.4 Vitest Config

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/features/**/utils/**', 'src/features/**/hooks/**', 'src/lib/**'],
      exclude: ['src/components/ui/**', 'src/routes/**'],
      thresholds: {
        // Coverage obrigatório apenas em utils e hooks
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

---

## 11. Storybook

### 11.1 Config

```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    '../src/components/**/*.stories.@(ts|tsx)',
    '../src/features/**/components/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',          // Acessibilidade
    '@storybook/addon-themes',         // Toggle dark/light
  ],
  framework: '@storybook/react-vite',
};

export default config;
```

### 11.2 Convenção de Stories

```typescript
// features/applications/components/ApplicationStatus.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { ApplicationStatusBadge } from './ApplicationStatus';

const meta: Meta<typeof ApplicationStatusBadge> = {
  title: 'Features/Applications/StatusBadge',
  component: ApplicationStatusBadge,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ApplicationStatusBadge>;

export const Queued: Story = { args: { status: 'QUEUED' } };
export const Applying: Story = { args: { status: 'APPLYING' } };
export const Submitted: Story = { args: { status: 'SUBMITTED' } };
export const Failed: Story = { args: { status: 'FAILED' } };
export const Retrying: Story = { args: { status: 'RETRYING' } };
export const Exhausted: Story = { args: { status: 'EXHAUSTED' } };
```

---

## 12. Linters & Code Quality

### 12.1 ESLint (Frontend-específico)

Estende a config do backend com regras React:

```javascript
// packages/frontend/.eslintrc.cjs
module.exports = {
  extends: [
    '../../.eslintrc.cjs',                    // Herda regras base do monorepo
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',            // Acessibilidade
    'plugin:@tanstack/eslint-plugin-query',   // TanStack Query best practices
  ],
  plugins: ['react', 'react-hooks', 'jsx-a11y', '@tanstack/query'],
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',          // React 19 não precisa
    'react/prop-types': 'off',                   // TypeScript cuida disso
    'react-hooks/exhaustive-deps': 'error',      // Deps de useEffect obrigatórias
    'jsx-a11y/anchor-is-valid': 'off',           // TanStack Router usa <Link>

    // Previne import de server state em client state
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['@tanstack/react-query'],
          importNames: ['useQuery', 'useMutation'],
          message: 'Import query hooks from feature-specific hooks, not directly.',
        },
      ],
    }],
  },
};
```

Nota: A regra `no-restricted-imports` para `useQuery`/`useMutation` é **opinativa** — força que queries sejam encapsuladas em hooks de feature ao invés de chamadas inline nos componentes. Isso centraliza query keys e configs. Pode relaxar se preferir.

### 12.2 Import Boundaries

```javascript
// Na config ESLint base do monorepo, já temos:
'import/no-restricted-paths': ['error', {
  zones: [
    // Frontend features não importam entre si diretamente
    // (se precisar compartilhar, move para components/shared ou lib/)
    {
      target: './src/features/jobs',
      from: './src/features/applications',
      message: 'Features should not import from each other. Use shared components.',
    },
    {
      target: './src/features/applications',
      from: './src/features/jobs',
      message: 'Features should not import from each other. Use shared components.',
    },
    // Routes não contêm lógica
    {
      target: './src/routes',
      from: './src/lib/api',
      message: 'Routes should not import API directly. Use feature hooks.',
    },
  ],
}],
```

---

## 13. Performance

### 13.1 Code Splitting

TanStack Router com `autoCodeSplitting: true` no Vite plugin gera chunks separados automaticamente por rota. Resultado:

- Chunk inicial: ~80KB (React + Router + auth)
- Cada rota carrega sob demanda (~20-50KB)
- Dashboard com Recharts é o chunk mais pesado (~60KB) — carrega só quando acessado

### 13.2 Otimizações

| Técnica | Onde | Como |
|---------|------|------|
| **Lazy loading** | Rotas | Automático pelo TanStack Router |
| **Prefetch** | Loaders | `queryClient.ensureQueryData()` no loader da rota |
| **Stale-while-revalidate** | Queries | `placeholderData: previousData` mantém UI responsiva |
| **Debounce** | Search input | 300ms debounce no campo de busca |
| **Virtualization** | Listas longas | TanStack Virtual para listas 100+ items |
| **Skeleton** | Loading states | Skeletons em vez de spinners para layout shift mínimo |
| **Selective subscriptions** | Zustand | Selectors para evitar re-renders desnecessários |

### 13.3 Zustand Selective Subscriptions

```typescript
// ❌ ERRADO — re-render em qualquer mudança do store
const store = useUIStore();

// ✅ CORRETO — re-render apenas quando sidebarCollapsed muda
const collapsed = useUIStore((s) => s.sidebarCollapsed);
```

---

## 14. Pacote Compartilhado (@autoapply/shared)

Types e schemas compartilhados entre frontend e backend, garantindo consistência:

```
packages/shared/
├── src/
│   ├── types/
│   │   ├── api.ts              # ApiResponse<T>, PaginatedResponse<T>, ApiError
│   │   ├── jobs.ts             # JobListing, SearchParams, JobPlatform
│   │   ├── applications.ts     # Application, ApplicationStatus, BatchApplyInput
│   │   ├── profile.ts          # UserProfile, ProfileCompleteness
│   │   ├── credits.ts          # CreditBalance, CreditTransaction, Plan
│   │   └── dashboard.ts        # DashboardStats, ActivityItem
│   ├── schemas/
│   │   ├── search.schema.ts    # Zod schema para busca (usado em front + back)
│   │   ├── profile.schema.ts   # Zod schema para perfil
│   │   └── application.schema.ts
│   ├── constants/
│   │   ├── platforms.ts        # Plataformas suportadas
│   │   ├── plans.ts            # Limites por plano
│   │   └── status.ts           # Status transitions permitidas
│   └── index.ts                # Barrel export
├── tsconfig.json
└── package.json
```

Exemplo de tipo compartilhado:

```typescript
// packages/shared/src/types/api.ts
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    page: number;
    perPage: number;
    total: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// O frontend usa esses tipos nos endpoints
// O backend usa esses tipos nas responses
// Zod schemas são usados para validação em ambos
```

---

## 15. CI/CD (Frontend)

### 15.1 Pipeline

```yaml
# Dentro do ci.yml do monorepo (Turborepo filtra automaticamente)
frontend:
  steps:
    - pnpm turbo lint --filter=frontend
    - pnpm turbo type-check --filter=frontend
    - pnpm turbo test:unit --filter=frontend
    - pnpm turbo build --filter=frontend
    # Storybook build (para deploy do catálogo)
    - pnpm turbo build-storybook --filter=frontend
```

### 15.2 Deploy

| Ambiente | Trigger | Plataforma |
|----------|---------|------------|
| **Preview** | PR aberto | Vercel/Netlify preview deploy |
| **Staging** | Merge em `main` | Vercel/Netlify staging |
| **Prod** | Tag release `v*` | Vercel/Netlify production |
| **Storybook** | Merge em `main` | Chromatic ou Netlify separado |

SPA puro → deploy é servir arquivos estáticos. Qualquer CDN funciona.

---

## 16. Environment Variables

```bash
# packages/frontend/.env.example

# API
VITE_API_URL=http://localhost:3001/api

# Better Auth
VITE_AUTH_URL=http://localhost:3001

# Feature flags (futuro)
VITE_ENABLE_LINKEDIN=true
VITE_ENABLE_INDEED=true

# Polling
VITE_DEFAULT_POLL_INTERVAL=5000
```

Nota: Variáveis do Vite precisam do prefixo `VITE_` para serem expostas ao client bundle.

---

## 17. Próximos Passos (Frontend)

### Quando começar

O frontend **não começa agora**. Sequência recomendada:

1. Backend MVP funcional (API + Workers rodando)
2. Testar fluxos via CLI/curl/Postman
3. **Então** montar o frontend

### Ordem de construção (quando iniciar)

1. **Setup Vite + TanStack Router** — Scaffold com rotas básicas
2. **shadcn/ui + tema dark** — Design tokens + componentes base
3. **Better Auth UI** — Login/Register funcionais
4. **Profile page** — Form de perfil + upload currículo
5. **Jobs search** — Busca com filtros na URL
6. **Applications page** — Tabela + batch apply + polling
7. **Dashboard** — Stats + gráficos
8. **Credits page** — Saldo + histórico
9. **Storybook** — Catálogo de componentes
10. **Testes** — Utils → Hooks → Componentes críticos

---

## 18. Decisões Arquiteturais Registradas (ADRs)

| # | Decisão | Contexto | Alternativa rejeitada |
|---|---------|----------|----------------------|
| F-001 | TanStack Router, não React Router | Search params type-safe, file-based routing, loaders | React Router v7 (sem type safety em search params) |
| F-002 | Vite, não Next.js | SPA puro, sem necessidade de SSR/SEO | Next.js App Router (overhead desnecessário) |
| F-003 | TanStack Query para server state | Caching automático, invalidação, polling | SWR (similar, mas menos features de mutation) |
| F-004 | Zustand apenas para client state | Leve, sem providers, stores isolados | Jotai (atomic, mais complexo), Redux (overkill) |
| F-005 | Feature-based, não layer-based | Co-localização, escalável, navegável | Layer-based (components/, hooks/, services/) |
| F-006 | ky, não axios | Menor bundle, fetch nativo, retry built-in | axios (maior, XMLHttpRequest legacy) |
| F-007 | MSW para mocks de teste | Intercepta no nível de rede, realista | JSON fixtures direto (não testa integração HTTP) |
| F-008 | Storybook para catálogo visual | Documentação viva, acessibilidade | Apenas testes (sem catálogo visual) |
| F-009 | Sem state management para server data | TanStack Query é o cache | Zustand para tudo (bug de sincronização) |
| F-010 | Filtros na URL, não em estado | Compartilhável, botão voltar funciona | Zustand/useState (perde estado ao navegar) |
