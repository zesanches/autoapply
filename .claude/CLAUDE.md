# AutoApply

> Agente autônomo de candidatura a vagas com browser automation, Claude AI e dashboard de monitoramento.

## O Que É Este Projeto

AutoApply é um sistema que busca vagas de emprego, analisa compatibilidade com o perfil do usuário, preenche formulários e envia candidaturas automaticamente. O core é um **orquestrador de agentes com browser automation** — a UI serve para configurar, monitorar e controlar o agente.

## Fase Atual

**MVP Local** — CLI + API local + Worker local. O sistema roda na máquina do desenvolvedor via Docker Compose. A versão web (SaaS multi-tenant) é a fase seguinte.

## Arquitetura

Monorepo com pnpm workspaces + Turborepo.

```
autoapply/
├── packages/
│   ├── backend/          # API Fastify + Workers BullMQ + Playwright
│   ├── frontend/         # React SPA + TanStack Router (futuro)
│   ├── shared/           # Types e Zod schemas compartilhados
│   └── cli/              # CLI wrapper (futuro)
├── docs/
│   ├── BACKEND-ARCHITECTURE.md
│   ├── FRONTEND-ARCHITECTURE.md
│   ├── INFRA-ARCHITECTURE.md
│   └── SECURITY-ARCHITECTURE.md
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── CLAUDE.md             # Este arquivo
```

## Stack

### Backend
- **Runtime**: Node.js 22+ LTS, TypeScript 5.x strict mode
- **HTTP**: Fastify (schema validation nativa, auto-geração OpenAPI)
- **ORM**: Prisma (type-safe queries, migrations automáticas)
- **Database**: PostgreSQL 16
- **Cache/Queue**: Redis 7+ com BullMQ
- **Auth**: Better Auth (self-hosted, Prisma adapter, plugin ecosystem)
- **Browser**: Playwright (Chromium, stealth mode, anti-detecção)
- **AI**: Claude Code SDK (local) / Anthropic API (versão web)
- **Validação**: Zod (runtime + inferência TS)
- **Logger**: Pino (structured JSON)

### Frontend (futuro, não implementar agora)
- **Framework**: React 19 + Vite 6
- **Routing**: TanStack Router (file-based, type-safe search params)
- **Server State**: TanStack Query v5
- **Client State**: Zustand (apenas UI state, nunca server data)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Auth UI**: Better Auth UI (componentes prontos com shadcn)
- **HTTP**: ky (wrapper sobre fetch)

### Infra
- **Containers**: Docker Compose (local), Railway (produção)
- **CI/CD**: GitHub Actions + Turborepo cache
- **Monitoring**: Sentry (errors) + Prometheus/Grafana (metrics)
- **DNS/SSL**: Cloudflare

## Arquitetura Backend — Clean Architecture Adaptada

```
src/
├── domain/           # Regras de negócio puras (ZERO deps externas)
│   ├── entities/     # User, JobListing, Application, UserProfile, Credit
│   ├── value-objects/ # Email, JobPlatform, ApplicationStatus, CreditBalance
│   ├── errors/       # Domain errors (sem HTTP codes)
│   └── events/       # ApplicationSubmitted, CreditDeducted, etc.
│
├── application/      # Use Cases (orquestra domain, depende só de ports)
│   ├── use-cases/    # SearchJobs, ApplyToJob, BatchApply, RetryApplication, etc.
│   └── ports/        # Interfaces: IJobSearcher, IJobApplier, IFormAnalyzer, repos
│
├── infrastructure/   # Implementações concretas
│   ├── database/     # Prisma schema + repositories (implementam ports)
│   ├── queue/        # BullMQ service + workers (processo separado)
│   ├── browser/      # BrowserPool + platform adapters (Indeed, LinkedIn)
│   ├── ai/           # Claude providers (local SDK e API REST)
│   ├── auth/         # Better Auth config
│   └── http/         # Fastify server, routes, middlewares
│
└── shared/           # Config, logger, DI container, types
```

**Dependency Rule**: Dependências apontam para dentro. Domain não importa de Application nem Infrastructure. Application não importa de Infrastructure. ESLint enforce isso via `import/no-restricted-paths`.

## Design Patterns em Uso

1. **Strategy Pattern** — Platform adapters (IndeedAdapter, LinkedInAdapter) implementam IJobSearcher + IJobApplier. PlatformRegistry resolve adapter por platform string.
2. **Unit of Work** — Créditos usam reserve/confirm/rollback para consistência transacional.
3. **State Machine** — ApplicationStatus com transições válidas definidas: `queued → applying → submitted | failed → retrying → applying | exhausted`.
4. **Dependency Injection** — Factory function manual (`createContainer()`). Sem container de DI externo no MVP.

## Fluxo Principal: Candidatura

```
POST /api/applications/batch
  → Valida input (Zod) → Verifica auth → Verifica créditos
  → BatchApplyUseCase reserva N créditos
  → Enfileira N jobs no BullMQ (com delay anti-spam: 60s + jitter)
  → Retorna batchId

ApplicationWorker (processo separado):
  → Pega instância do BrowserPool
  → Resolve adapter via PlatformRegistry (Indeed ou LinkedIn)
  → Navega até a vaga
  → Chama IFormAnalyzer (Claude) para entender o formulário
  → Mapeia perfil do usuário → campos do formulário
  → Preenche e submete com delays humanos
  → Verifica confirmação de envio
  → Sucesso: confirma crédito | Falha: retry (max 5, backoff exponencial)
```

## Regras Importantes

### Segurança
- **API keys do Anthropic dos usuários**: Encriptadas com AES-256-GCM no banco. Decriptadas apenas no Worker no momento do uso. NUNCA expostas ao frontend.
- **Sessões**: Armazenadas no Postgres (não JWT). Cookies httpOnly, Secure, SameSite=Lax.
- **Validação**: Zod schema em TODA rota. Nunca confiar em input do cliente.
- **Access Control**: userId sempre derivado do session token, nunca do request body. Retornar 404 (não 403) para recursos de outro usuário.
- **Error handling**: Nunca expor stack traces em produção. Log completo internamente, resposta genérica ao cliente.
- **Logs**: Pino com redaction automática de `authorization`, `cookie`, `password`, `token`, `apiKey`.

### LGPD (Lei Geral de Proteção de Dados)
- O projeto processa dados de brasileiros — LGPD se aplica integralmente.
- Consentimento explícito obrigatório para upload de currículo.
- Endpoint de exclusão de conta (`DELETE /api/privacy/account`) deve deletar TODOS os dados do usuário.
- Audit logs são append-only e sobrevivem à exclusão de conta (sem PII).
- Privacy Policy deve listar todos os processadores: Railway, Anthropic, Vercel, Sentry.

### Anti-Spam
- BullMQ rate limiter: 1 job a cada 45 segundos no Worker.
- Delay entre jobs do mesmo batch: 60s base + 0-30s jitter aleatório.
- Browser com user-agent rotation, viewport randomization, delays humanos entre cliques.
- Whitelist de domínios para navegação (Indeed, LinkedIn apenas).

### Créditos
- 1 crédito = 1 candidatura enviada com sucesso.
- Falha após 5 retries = crédito devolvido (rollback).
- Planos: FREE (10/mês), PRO (100/mês), ENTERPRISE (ilimitado).
- CreditTransaction é a source of truth. CreditBalance é snapshot para performance.
- Constraint de banco `@@unique([userId, jobId])` impede candidatura duplicada.

### Worker
- Worker roda em PROCESSO SEPARADO da API (Docker service distinto).
- Playwright consome ~200-400MB RAM por instância de browser.
- BrowserPool com max de instâncias configurável (`MAX_BROWSER_INSTANCES`).
- Cada candidatura roda em browser context isolado (sem leak de cookies entre candidaturas).
- Timeout por página: 30s. Timeout de navegação: 15s.

## Database

Postgres 16 com Prisma. Modelos principais:

- `User` — Dados de auth (Better Auth managed)
- `UserProfile` — Perfil do candidato (skills, experiência, resumeData como JSON)
- `CreditBalance` — Saldo disponível, reservado, plano
- `CreditTransaction` — Audit trail de créditos (append-only)
- `JobListing` — Vaga normalizada (`@@unique([externalId, platform])`)
- `Application` — Candidatura (`@@unique([userId, jobId])`, status FSM)
- `SearchHistory` — Histórico de buscas
- `AuditLog` — Ações sensíveis (sem FK para User — sobrevive a exclusão)

## API REST

Padrão de response:
```json
// Sucesso
{ "success": true, "data": { ... }, "meta": { "page": 1, "perPage": 20, "total": 150 } }

// Erro
{ "success": false, "error": { "code": "INSUFFICIENT_CREDITS", "message": "...", "details": { ... } } }
```

Endpoints principais:
```
POST   /api/auth/sign-up, sign-in, sign-out    (Better Auth)
GET    /api/auth/session

GET/PUT /api/profile
POST    /api/profile/resume

POST   /api/jobs/search
GET    /api/jobs/:id
POST   /api/jobs/:id/analyze

POST   /api/applications
POST   /api/applications/batch
GET    /api/applications
GET    /api/applications/:id
GET    /api/applications/:id/logs

GET    /api/credits
GET    /api/credits/transactions

GET    /api/dashboard/stats
GET    /api/dashboard/activity

GET    /api/privacy/export
DELETE /api/privacy/account

GET    /health
GET    /metrics
```

## Testes

- **TDD para**: Use cases, domain entities, value objects, state transitions, queue retry logic.
- **Integration tests**: Repositories com Postgres real (testcontainers), rotas com Supertest.
- **NÃO TDD para**: Platform adapters (usam contract tests com fixtures HTML), componentes visuais (Storybook), integração com Claude (mock do IFormAnalyzer).
- **Framework**: Vitest.
- **Coverage mínimo**: 80% em branches, functions, lines, statements (exceto infrastructure/).

## Comandos

```bash
# Desenvolvimento
pnpm install                          # Instala tudo
docker compose up -d                  # Sobe Postgres + Redis
pnpm turbo dev                        # API + Worker em dev mode

# Testes
pnpm turbo test:unit                  # Testes unitários
pnpm turbo test:integration           # Testes com DB real
pnpm turbo lint                       # ESLint
pnpm turbo type-check                 # tsc --noEmit
pnpm turbo format:check               # Prettier check

# Database
pnpm --filter @autoapply/backend exec prisma migrate dev --name <nome>
pnpm --filter @autoapply/backend exec prisma migrate deploy
pnpm --filter @autoapply/backend exec prisma studio

# Build
pnpm turbo build                      # Build de produção
docker compose -f docker-compose.yml build --parallel
```

## Convenções

- **Commits**: Conventional Commits obrigatórios (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`, `docs:`).
- **Branches**: `main` (produção), `develop` (desenvolvimento), `feat/*`, `fix/*`.
- **Imports**: Ordenados por grupo (builtin → external → internal → parent → sibling). ESLint enforce.
- **Nomes**: camelCase para variáveis/funções, PascalCase para classes/types/components, kebab-case para arquivos.
- **Errors**: Domain errors extendem `Error` com nome específico. Middleware mapeia para HTTP status.

## Documentação Detalhada

Para decisões arquiteturais completas, consultar:
- `docs/BACKEND-ARCHITECTURE.md` — Camadas, patterns, schema, queue, browser automation
- `docs/FRONTEND-ARCHITECTURE.md` — Feature-based, routing, state management, design system
- `docs/INFRA-ARCHITECTURE.md` — Docker, CI/CD, Railway, observabilidade, custos
- `docs/SECURITY-ARCHITECTURE.md` — OWASP Top 10, LGPD, threat model, encryption, incident response
