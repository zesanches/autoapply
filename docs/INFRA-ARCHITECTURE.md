# AutoApply — Arquitetura de Infraestrutura

> Documento vivo. Fonte da verdade para decisões de infra, CI/CD, observabilidade e operações.
> Complementar a `BACKEND-ARCHITECTURE.md` e `FRONTEND-ARCHITECTURE.md` — leia-os antes.
> Última atualização: 2026-03-05

---

## 1. Visão Geral

A infra do AutoApply é desenhada para duas realidades:

1. **MVP Local**: Tudo roda na máquina do desenvolvedor via Docker Compose. Zero custo de cloud.
2. **Produção Web**: Serviços containerizados em Railway, com escalabilidade independente por camada.

O princípio guia é: **funciona local idêntico a produção**. Docker Compose espelha a topologia de produção para que bugs de infra sejam capturados antes do deploy.

### 1.1 Topologia de Serviços

```
┌──────────────────────────────────────────────────────────────────┐
│                         INTERNET                                  │
└─────────┬──────────────────────────────────┬─────────────────────┘
          │                                  │
          ▼                                  ▼
┌──────────────────┐              ┌──────────────────┐
│   CDN / Vercel   │              │  Railway / Proxy  │
│   (Frontend SPA) │              │   (API Gateway)   │
└──────────────────┘              └────────┬─────────┘
                                           │
                          ┌────────────────┼────────────────┐
                          ▼                │                ▼
                 ┌────────────────┐        │       ┌────────────────┐
                 │   API Server   │        │       │   API Server   │
                 │  (Fastify)     │        │       │   (replica)    │
                 │  Port 3001     │        │       │   Port 3001    │
                 └───────┬────────┘        │       └───────┬────────┘
                         │                 │               │
              ┌──────────┼─────────────────┼───────────────┘
              │          │                 │
              ▼          ▼                 ▼
     ┌──────────┐  ┌──────────┐   ┌──────────────────┐
     │ Postgres │  │  Redis   │   │  Worker (BullMQ)  │
     │  (data)  │  │ (queue   │   │  + Playwright     │
     │          │  │  + cache) │   │  (1-N instâncias) │
     └──────────┘  └──────────┘   └──────────────────┘
```

### 1.2 Stack de Infra

| Camada | Local (MVP) | Produção (Web) |
|--------|-------------|----------------|
| **Containers** | Docker Compose | Railway (Docker deploy) |
| **Database** | Postgres 16 (container) | Railway Postgres (managed) |
| **Cache/Queue** | Redis 7 (container) | Railway Redis (managed) |
| **Frontend** | Vite dev server | Vercel / Netlify (SPA estático) |
| **CI/CD** | — | GitHub Actions |
| **Monitoring** | Pino logs (stdout) | Sentry + Grafana Cloud (free tier) |
| **DNS** | localhost | Cloudflare (proxy + SSL) |
| **Secrets** | .env local | Railway env vars / GitHub Secrets |
| **Storage** | Filesystem local | Railway Volume / S3 (currículos) |

---

## 2. Ambientes

### 2.1 Mapa de Ambientes

| Ambiente | Propósito | Trigger | Infra | URL |
|----------|-----------|---------|-------|-----|
| **local** | Desenvolvimento | `docker compose up` | Docker Compose | `localhost:3001` (API), `localhost:5173` (front) |
| **preview** | Review de PR | PR aberto no GitHub | Railway preview env | `pr-{n}.autoapply.railway.app` |
| **staging** | QA antes de prod | Merge em `main` | Railway staging project | `staging.autoapply.app` |
| **production** | Produção real | Tag `v*` ou merge em `release` | Railway prod project | `api.autoapply.app` |

### 2.2 Princípio de Paridade

Todos os ambientes usam:
- Mesmo Dockerfile (multi-stage, target diferente)
- Mesma versão de Postgres e Redis
- Mesmas env vars (valores diferentes, nomes iguais)
- Mesmo schema Prisma

Diferenças permitidas:
- Volumes de dados (local = Docker volume, prod = managed)
- Recursos (local = limites de CPU/RAM menores)
- SSL (local = HTTP, prod = HTTPS via Cloudflare)
- Replicas (local = 1 de cada, prod = N workers)

---

## 3. Docker

### 3.1 Dockerfile Multi-Stage (Backend)

```dockerfile
# ─── Stage 1: Base ──────────────────────────────────────────
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ─── Stage 2: Prune (Turborepo) ────────────────────────────
FROM base AS pruner
RUN pnpm add -g turbo
COPY . .
# Prune para incluir apenas o backend e suas deps
RUN turbo prune @autoapply/backend --docker

# ─── Stage 3: Install deps ─────────────────────────────────
FROM base AS installer
# Copia lockfile e package.jsons (do output do prune)
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Copia source code
COPY --from=pruner /app/out/full/ .
# Gera Prisma client
RUN pnpm --filter @autoapply/backend exec prisma generate
# Build
RUN pnpm turbo build --filter=@autoapply/backend

# ─── Stage 4: Development ──────────────────────────────────
FROM base AS development
WORKDIR /app
COPY --from=installer /app .
# Playwright browsers (só no dev e worker)
RUN npx playwright install --with-deps chromium
EXPOSE 3001
CMD ["pnpm", "--filter", "@autoapply/backend", "dev"]

# ─── Stage 5: Production (API) ─────────────────────────────
FROM base AS production-api
WORKDIR /app
ENV NODE_ENV=production

# Copia apenas o necessário
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/packages/backend/dist ./packages/backend/dist
COPY --from=installer /app/packages/backend/prisma ./packages/backend/prisma
COPY --from=installer /app/packages/backend/package.json ./packages/backend/package.json
COPY --from=installer /app/packages/shared/dist ./packages/shared/dist
COPY --from=installer /app/package.json ./package.json

# Usuário não-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser
USER appuser

EXPOSE 3001
CMD ["node", "packages/backend/dist/main.js"]

# ─── Stage 6: Production (Worker) ──────────────────────────
FROM base AS production-worker
WORKDIR /app
ENV NODE_ENV=production

COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/packages/backend/dist ./packages/backend/dist
COPY --from=installer /app/packages/backend/prisma ./packages/backend/prisma
COPY --from=installer /app/packages/backend/package.json ./packages/backend/package.json
COPY --from=installer /app/packages/shared/dist ./packages/shared/dist
COPY --from=installer /app/package.json ./package.json

# Playwright + Chromium para browser automation
RUN npx playwright install --with-deps chromium

# Security: capabilities limitadas
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 workeruser
USER workeruser

CMD ["node", "packages/backend/dist/infrastructure/queue/workers/ApplicationWorker.js"]
```

Decisões:

- **Turbo prune**: Copia apenas os pacotes necessários para o backend, reduzindo o contexto de build drasticamente.
- **Targets separados** para API e Worker: Worker precisa do Chromium (~400MB), API não. Imagens separadas = deploy menor para a API.
- **Usuário não-root**: Segurança básica em containers. Nunca rodar como root em produção.
- **Playwright só no Worker**: A API não precisa de browser. Instalar Chromium na API seria desperdício de ~400MB de imagem.

### 3.2 Docker Compose (Desenvolvimento)

```yaml
# docker-compose.yml
name: autoapply

services:
  # ─── Database ────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: autoapply
      POSTGRES_PASSWORD: autoapply_dev
      POSTGRES_DB: autoapply
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U autoapply']
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── Redis ───────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redisdata:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru

  # ─── API Server ──────────────────────────────────────────
  api:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
      target: development
    ports:
      - '3001:3001'
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://autoapply:autoapply_dev@postgres:5432/autoapply
      REDIS_URL: redis://redis:6379
      BETTER_AUTH_SECRET: dev-secret-min-32-characters-long!!
      BETTER_AUTH_URL: http://localhost:3001
      PORT: 3001
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./packages/backend/src:/app/packages/backend/src
      - ./packages/shared/src:/app/packages/shared/src
    command: pnpm --filter @autoapply/backend dev

  # ─── Worker ──────────────────────────────────────────────
  worker:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
      target: development
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://autoapply:autoapply_dev@postgres:5432/autoapply
      REDIS_URL: redis://redis:6379
      MAX_BROWSER_INSTANCES: 2
      BROWSER_HEADLESS: 'true'
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./packages/backend/src:/app/packages/backend/src
      - ./packages/shared/src:/app/packages/shared/src
    command: pnpm --filter @autoapply/backend dev:worker
    # Worker precisa de mais memória por causa do Playwright
    deploy:
      resources:
        limits:
          memory: 2G

  # ─── BullMQ Dashboard (dev only) ────────────────────────
  bull-board:
    image: deadly0/bull-board:latest
    ports:
      - '3002:3000'
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
    depends_on:
      - redis

volumes:
  pgdata:
  redisdata:
```

### 3.3 Docker Compose Override (Produção)

```yaml
# docker-compose.prod.yml
# Usado como referência. Em Railway, cada service é configurado individualmente.
name: autoapply-prod

services:
  api:
    build:
      target: production-api
    environment:
      NODE_ENV: production
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 512M
    restart: unless-stopped

  worker:
    build:
      target: production-worker
    environment:
      NODE_ENV: production
      MAX_BROWSER_INSTANCES: 3
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 4G    # Playwright consome bastante
    restart: unless-stopped
```

---

## 4. CI/CD (GitHub Actions)

### 4.1 Filosofia

O pipeline de CI/CD segue estes princípios:

1. **Fail fast**: Lint e type-check rodam primeiro (rápidos). Testes só se passarem.
2. **Affected only**: Turborepo `--filter` garante que só pacotes modificados são testados/buildados.
3. **Cache agressivo**: pnpm store, Turborepo cache, Docker layer cache.
4. **Ambientes isolados**: PR → preview, main → staging, tag → prod.

### 4.2 Pipeline CI

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true  # Cancela runs anteriores no mesmo PR

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}

jobs:
  # ─── Quality Gate (rápido, sem DB) ─────────────────────
  quality:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Necessário para Turborepo --filter

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # Turborepo remote cache + affected-only
      - name: Lint
        run: pnpm turbo lint --filter='...[origin/main]'

      - name: Type Check
        run: pnpm turbo type-check --filter='...[origin/main]'

      - name: Format Check
        run: pnpm turbo format:check --filter='...[origin/main]'

  # ─── Unit Tests ────────────────────────────────────────
  test-unit:
    name: Unit Tests
    needs: quality
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo test:unit --filter='...[origin/main]'

      - name: Upload coverage
        if: always()
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: packages/backend/coverage/lcov.info,packages/frontend/coverage/lcov.info
          fail_ci_if_error: false

  # ─── Integration Tests (com DB) ────────────────────────
  test-integration:
    name: Integration Tests
    needs: quality
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: autoapply_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Run migrations
        run: pnpm --filter @autoapply/backend exec prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/autoapply_test

      - name: Integration tests
        run: pnpm turbo test:integration --filter=@autoapply/backend
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/autoapply_test
          REDIS_URL: redis://localhost:6379

  # ─── Build check ───────────────────────────────────────
  build:
    name: Build
    needs: [test-unit, test-integration]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build --filter='...[origin/main]'
```

### 4.3 Pipeline CD — Deploy

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  # ─── Deploy Staging (merge em main) ───────────────────
  deploy-staging:
    if: github.ref == 'refs/heads/main' && !startsWith(github.ref, 'refs/tags/')
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Deploy API to Railway (staging)
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN_STAGING }}
          service: api

      - name: Deploy Worker to Railway (staging)
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN_STAGING }}
          service: worker

      - name: Run migrations (staging)
        run: |
          railway run --service api -- pnpm --filter @autoapply/backend exec prisma migrate deploy
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_STAGING }}

  # ─── Deploy Production (tag v*) ────────────────────────
  deploy-production:
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    environment: production
    needs: []  # Tag já passou pelo CI via main
    steps:
      - uses: actions/checkout@v4

      - name: Deploy API to Railway (production)
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN_PROD }}
          service: api

      - name: Deploy Worker to Railway (production)
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN_PROD }}
          service: worker

      - name: Run migrations (production)
        run: |
          railway run --service api -- pnpm --filter @autoapply/backend exec prisma migrate deploy
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_PROD }}

      - name: Notify Sentry release
        uses: getsentry/action-release@v1
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ vars.SENTRY_ORG }}
          SENTRY_PROJECT: autoapply-api
        with:
          environment: production
          version: ${{ github.ref_name }}

  # ─── Deploy Frontend ───────────────────────────────────
  deploy-frontend:
    if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build --filter=@autoapply/frontend

      # Vercel deploy (ou Netlify)
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: packages/frontend
          vercel-args: ${{ startsWith(github.ref, 'refs/tags/v') && '--prod' || '' }}
```

### 4.4 Turborepo Config

```json
// turbo.json
{
  "$schema": "https://turborepo.dev/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "cache": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "type-check": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "format:check": {
      "cache": true
    },
    "test:unit": {
      "dependsOn": ["^build"],
      "cache": true,
      "outputs": ["coverage/**"]
    },
    "test:integration": {
      "dependsOn": ["^build"],
      "cache": false,
      "env": ["DATABASE_URL", "REDIS_URL"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "dev:worker": {
      "cache": false,
      "persistent": true
    },
    "build-storybook": {
      "dependsOn": ["^build"],
      "outputs": ["storybook-static/**"],
      "cache": true
    }
  }
}
```

---

## 5. Railway — Produção

### 5.1 Por que Railway?

Railway foi escolhido por três motivos:

1. **Docker-native**: Deploy de Dockerfiles com zero config. Suporta multi-service (API + Worker + DB + Redis) num único projeto.
2. **Monorepo-friendly**: Watch paths permitem deploy seletivo por pacote modificado.
3. **Custo previsível para MVP**: Plano hobby é suficiente para validação. Escala para Pro quando necessário sem migração.

Alternativas consideradas: Fly.io (bom mas DX pior para multi-service), Render (sem queue native), AWS ECS (overkill para MVP).

### 5.2 Topologia no Railway

```
Railway Project: autoapply-staging
├── Service: api
│   ├── Source: GitHub (monorepo)
│   ├── Dockerfile: packages/backend/Dockerfile
│   ├── Build target: production-api
│   ├── Watch paths: packages/backend/**, packages/shared/**
│   ├── Domain: staging-api.autoapply.app
│   └── Scaling: 1 replica, 512MB RAM
│
├── Service: worker
│   ├── Source: GitHub (monorepo)
│   ├── Dockerfile: packages/backend/Dockerfile
│   ├── Build target: production-worker
│   ├── Watch paths: packages/backend/**, packages/shared/**
│   ├── Domain: (interno, sem endpoint público)
│   └── Scaling: 1 replica, 2GB RAM
│
├── Database: postgres
│   ├── Image: postgres:16
│   ├── Volume: persistent
│   └── Backups: daily (Railway native)
│
└── Database: redis
    ├── Image: redis:7
    └── Config: maxmemory 256mb, allkeys-lru
```

### 5.3 Variáveis de Ambiente (Railway)

Railway permite referência entre serviços usando `${{ service.VAR }}`:

```bash
# Service: api
DATABASE_URL=${{ Postgres.DATABASE_URL }}
REDIS_URL=${{ Redis.REDIS_URL }}
NODE_ENV=production
PORT=3001
BETTER_AUTH_SECRET=${{ shared.BETTER_AUTH_SECRET }}
BETTER_AUTH_URL=https://staging-api.autoapply.app
CORS_ORIGIN=https://staging.autoapply.app
SENTRY_DSN=${{ shared.SENTRY_DSN }}

# Service: worker (herda as mesmas + específicas)
DATABASE_URL=${{ Postgres.DATABASE_URL }}
REDIS_URL=${{ Redis.REDIS_URL }}
NODE_ENV=production
MAX_BROWSER_INSTANCES=3
BROWSER_HEADLESS=true
APPLICATION_DELAY_MS=45000
MAX_APPLICATION_RETRIES=5
SENTRY_DSN=${{ shared.SENTRY_DSN }}
```

### 5.4 Healthchecks

```typescript
// packages/backend/src/infrastructure/http/routes/health.routes.ts
// Railway precisa de um endpoint de health para saber se o serviço está vivo

app.get('/health', async (request, reply) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
    },
  };

  const allHealthy = Object.values(checks.checks).every(c => c === 'ok');
  reply.status(allHealthy ? 200 : 503).send(checks);
});

// Railway config:
// Healthcheck path: /health
// Healthcheck interval: 30s
// Healthcheck timeout: 10s
```

---

## 6. Database Operations

### 6.1 Migrations (Prisma)

```bash
# Criar nova migration durante desenvolvimento
pnpm --filter @autoapply/backend exec prisma migrate dev --name add_user_preferences

# Aplicar migrations em produção (CI/CD)
pnpm --filter @autoapply/backend exec prisma migrate deploy

# Reset completo (apenas dev)
pnpm --filter @autoapply/backend exec prisma migrate reset
```

Regras:

- Migrations são **sempre** forward-only em produção. Sem rollback automático.
- Se uma migration precisa ser revertida, cria-se uma nova migration que desfaz a alteração.
- Migrations rodam no pipeline de CD **antes** do deploy do novo código (pre-deploy command no Railway).
- Migrations que alteram constraints ou índices devem ser não-bloqueantes (`CREATE INDEX CONCURRENTLY`).

### 6.2 Backups

| Ambiente | Estratégia | Frequência | Retenção |
|----------|-----------|------------|----------|
| Local | Docker volume (não precisa) | — | — |
| Staging | Railway native backup | Diário | 7 dias |
| Production | Railway native + pg_dump para S3 | Diário + antes de migrations | 30 dias |

```yaml
# Backup script rodado via GitHub Actions schedule
# .github/workflows/backup.yml
name: Database Backup

on:
  schedule:
    - cron: '0 3 * * *'  # 3 AM UTC, diariamente

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Backup Postgres
        run: |
          PGPASSWORD=${{ secrets.PROD_DB_PASSWORD }} \
          pg_dump -h ${{ secrets.PROD_DB_HOST }} \
                  -U ${{ secrets.PROD_DB_USER }} \
                  -d autoapply \
                  -F custom \
                  -f backup-$(date +%Y%m%d).dump

      - name: Upload to S3
        uses: jakejarvis/s3-sync-action@master
        with:
          args: --include "*.dump"
        env:
          AWS_S3_BUCKET: autoapply-backups
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          SOURCE_DIR: .
```

### 6.3 Redis

Redis no AutoApply serve dois propósitos:

1. **BullMQ Queue**: Filas de candidaturas, buscas, análises
2. **Session cache**: Better Auth pode usar Redis para sessões (opcional, Postgres é suficiente para MVP)

Configuração de produção:

```
maxmemory 512mb
maxmemory-policy allkeys-lru    # Evicta chaves menos usadas quando cheio
appendonly yes                   # Persistência em disco (importante para filas)
save 900 1                       # Snapshot a cada 15min se ≥1 mudança
save 300 10                      # Snapshot a cada 5min se ≥10 mudanças
```

**Importante**: Redis com BullMQ precisa de `appendonly yes`. Sem persistência, um restart do Redis perde todos os jobs na fila.

---

## 7. Observabilidade

### 7.1 Os Três Pilares

| Pilar | Ferramenta | O que captura |
|-------|-----------|--------------|
| **Logs** | Pino (structured JSON) → stdout → Railway logs | Requests, erros, business events |
| **Errors** | Sentry | Exceções, stack traces, contexto do user, release health |
| **Metrics** | Prometheus (prom-client) → Grafana Cloud | Request rate, latency p50/p95/p99, queue depth, browser pool usage |

### 7.2 Logging (Pino)

```typescript
// shared/logger/index.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,  // JSON em produção (Railway captura stdout)
  base: {
    service: process.env.SERVICE_NAME || 'api',
    env: process.env.NODE_ENV,
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  // Redact campos sensíveis
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
    censor: '[REDACTED]',
  },
});
```

Convenções de log:

```typescript
// Business events (info)
logger.info({ userId, jobId, platform }, 'application.submitted');
logger.info({ userId, batchId, count: 5 }, 'batch.created');

// Warnings (não-fatal)
logger.warn({ userId, jobId, attempt: 3 }, 'application.retry');
logger.warn({ platform: 'linkedin' }, 'platform.rate_limited');

// Errors (requer atenção)
logger.error({ err, userId, jobId }, 'application.failed');
logger.error({ err }, 'browser.crash');
```

### 7.3 Sentry

```typescript
// packages/backend/src/shared/config/sentry.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION || 'dev',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  profilesSampleRate: 0.1,
  integrations: [
    Sentry.prismaIntegration(),     // Captura queries lentas
    Sentry.redisIntegration(),      // Captura operações Redis
  ],
  // Não enviar PII
  beforeSend(event) {
    if (event.user) {
      delete event.user.ip_address;
      delete event.user.email;
    }
    return event;
  },
});
```

O que monitorar com Sentry:

- **API**: Exceptions em route handlers, timeouts, 5xx errors
- **Worker**: Crashes do Playwright, falhas de formulário, max retries exceeded
- **Releases**: Associar deploys com erros para identificar regressões

### 7.4 Métricas (Prometheus + Grafana)

```typescript
// packages/backend/src/infrastructure/http/plugins/metrics.ts
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

const register = new Registry();
collectDefaultMetrics({ register });

// Métricas de negócio
export const metrics = {
  httpRequestDuration: new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [register],
  }),

  applicationsTotal: new Counter({
    name: 'applications_total',
    help: 'Total job applications attempted',
    labelNames: ['platform', 'status'],  // status: submitted, failed, exhausted
    registers: [register],
  }),

  applicationDuration: new Histogram({
    name: 'application_duration_seconds',
    help: 'Time to complete a job application',
    labelNames: ['platform'],
    buckets: [10, 30, 60, 120, 300],
    registers: [register],
  }),

  queueDepth: new Gauge({
    name: 'queue_depth',
    help: 'Number of jobs in queue',
    labelNames: ['queue', 'state'],  // state: waiting, active, delayed
    registers: [register],
  }),

  browserPoolActive: new Gauge({
    name: 'browser_pool_active',
    help: 'Number of active browser instances',
    registers: [register],
  }),

  creditsConsumed: new Counter({
    name: 'credits_consumed_total',
    help: 'Total credits consumed',
    labelNames: ['plan'],
    registers: [register],
  }),
};

// Endpoint para Prometheus scrape
export function metricsRoute(app: FastifyInstance) {
  app.get('/metrics', async (_, reply) => {
    reply.header('Content-Type', register.contentType);
    reply.send(await register.metrics());
  });
}
```

### 7.5 Dashboard Grafana — Painéis Essenciais

| Painel | Query Prometheus | Alerta |
|--------|-----------------|--------|
| Request Rate | `rate(http_request_duration_seconds_count[5m])` | > 100 req/s sustained |
| Latency P95 | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` | > 2s |
| Error Rate | `rate(http_request_duration_seconds_count{status=~"5.."}[5m])` | > 5% de 5xx |
| Application Success Rate | `rate(applications_total{status="submitted"}[1h]) / rate(applications_total[1h])` | < 70% |
| Queue Depth | `queue_depth{state="waiting"}` | > 100 jobs waiting |
| Browser Pool | `browser_pool_active` | = max (pool esgotado) |
| Credit Burn Rate | `rate(credits_consumed_total[1h])` | Informativo |

### 7.6 Alerting

| Severidade | Canal | Exemplo |
|-----------|-------|---------|
| **Critical** | Slack/Discord + SMS | API down (healthcheck fail), DB unreachable |
| **Warning** | Slack/Discord | Error rate > 5%, queue depth > 50, retry storm |
| **Info** | Slack (canal separado) | Deploy concluído, migration aplicada, backup ok |

Para o MVP, Sentry alerts (email) é suficiente. Grafana alerting (free tier) para métricas de infra.

---

## 8. Networking & DNS

### 8.1 Domínios

| Serviço | Domínio | Gerenciado por |
|---------|---------|----------------|
| Frontend (SPA) | `autoapply.app` | Vercel/Netlify |
| API | `api.autoapply.app` | Cloudflare → Railway |
| Staging API | `staging-api.autoapply.app` | Cloudflare → Railway |
| Storybook | `storybook.autoapply.app` | Netlify |

### 8.2 Cloudflare

Cloudflare na frente como proxy reverso oferece:

- **SSL/TLS**: Certificado gratuito, HTTPS automático
- **DDoS protection**: Gratuito no plano free
- **Caching de assets**: Headers estáticos do SPA
- **Rate limiting**: Camada adicional de proteção (plano pago se necessário)
- **Analytics**: Visibilidade de tráfego sem instrumentação

Config DNS:

```
Type    Name              Content                     Proxy
CNAME   api               autoapply-api.railway.app   ✅ Proxied
CNAME   staging-api       autoapply-staging.railway.app ✅ Proxied
CNAME   @                 cname.vercel-dns.com        ✅ Proxied
```

### 8.3 CORS

```typescript
// packages/backend/src/infrastructure/http/plugins/cors.ts
const ALLOWED_ORIGINS: Record<string, string[]> = {
  development: ['http://localhost:5173', 'http://localhost:3000'],
  staging: ['https://staging.autoapply.app'],
  production: ['https://autoapply.app', 'https://www.autoapply.app'],
};

app.register(cors, {
  origin: ALLOWED_ORIGINS[process.env.NODE_ENV || 'development'],
  credentials: true,  // Necessário para cookies de sessão
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

---

## 9. Segurança de Infraestrutura

### 9.1 Checklist por Camada

**Containers:**
- [ ] Imagens baseadas em Alpine (superfície de ataque menor)
- [ ] Usuário não-root em todos os containers de produção
- [ ] Scan de vulnerabilidades: `docker scout` ou Snyk no CI
- [ ] Sem secrets hardcoded no Dockerfile (usar ARG/ENV do runtime)
- [ ] `.dockerignore` exclui `node_modules`, `.env`, `.git`

**Rede:**
- [ ] Cloudflare proxy em todos os domínios públicos
- [ ] Postgres e Redis sem endpoint público (apenas rede interna Railway)
- [ ] API aceita requests apenas de origins permitidos (CORS)
- [ ] Rate limiting por IP (Cloudflare) + por usuário (Fastify)

**Secrets:**
- [ ] Env vars em Railway/GitHub Secrets, nunca no código
- [ ] `BETTER_AUTH_SECRET` com mínimo 32 caracteres, gerado aleatoriamente
- [ ] API keys do Anthropic encriptadas em repouso no banco (AES-256-GCM)
- [ ] Rotação de secrets a cada 90 dias (calendar reminder)
- [ ] `.env` no `.gitignore` (verificar com `git-secrets` no pre-commit)

**Database:**
- [ ] SSL obrigatório na conexão Postgres em produção
- [ ] Senha forte gerada automaticamente pelo Railway
- [ ] Backups diários com retenção de 30 dias
- [ ] Sem acesso externo direto ao DB (apenas via TCP proxy para admin)
- [ ] `pg_dump` antes de migrations destrutivas

**Dependências:**
- [ ] `pnpm audit` rodando no CI (non-blocking warning, blocking critical)
- [ ] Dependabot ou Renovate para atualizações automáticas
- [ ] Lock file commitado (`pnpm-lock.yaml`)
- [ ] Imagens Docker com tags fixas (não usar `:latest` em produção)

### 9.2 GitHub Actions Security

```yaml
# Exemplo de scan de vulnerabilidades no CI
security-scan:
  name: Security Scan
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Audit dependencies
      run: pnpm audit --audit-level=critical

    - name: Scan Docker image
      uses: docker/scout-action@v1
      with:
        command: cves
        image: autoapply-api:latest
        only-severities: critical,high
        exit-code: true  # Falha se houver CVE critical/high
```

---

## 10. Storage de Arquivos

### 10.1 Currículos (Upload de Usuários)

Currículos são arquivos sensíveis — contêm dados pessoais. Estratégia:

| Ambiente | Storage | Acesso |
|----------|---------|--------|
| Local | Filesystem (`./uploads/`) | Direto |
| Produção | AWS S3 / Railway Volume | Pre-signed URLs (expiram em 15 min) |

```typescript
// Estratégia de upload
// 1. Frontend envia arquivo via multipart/form-data
// 2. Backend valida (PDF/DOCX, max 5MB)
// 3. Backend salva no storage
// 4. Backend parseia conteúdo (extrair texto para preenchimento)
// 5. Backend salva URL + dados parseados no UserProfile

const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
```

Para o MVP local, filesystem é suficiente. Para produção, S3 com bucket privado + pre-signed URLs para download.

---

## 11. Escalabilidade

### 11.1 Gargalos Identificados

| Componente | Gargalo | Solução |
|-----------|---------|---------|
| **API** | CPU-bound sob carga | Scale horizontal (mais replicas) |
| **Worker** | RAM do Playwright (~400MB/instância) | Scale vertical (mais RAM) + horizontal |
| **Postgres** | Connections pool | PgBouncer como connection pooler |
| **Redis** | Memory para filas grandes | `maxmemory-policy` + monitoramento |
| **Browser** | Anti-bot detection sob escala | Rotação de IPs (proxy residencial — futuro) |

### 11.2 Scaling Strategy por Fase

**MVP (0-100 usuários)**:
- 1 API (512MB)
- 1 Worker (2GB, 2 browsers)
- 1 Postgres (1GB)
- 1 Redis (256MB)
- Custo estimado Railway: ~$10-20/mês

**Growth (100-1000 usuários)**:
- 2 APIs (512MB cada)
- 3 Workers (4GB cada, 3 browsers cada)
- 1 Postgres (4GB) + PgBouncer
- 1 Redis (1GB)
- Custo estimado: ~$50-100/mês

**Scale (1000+ usuários)**:
- Auto-scaling APIs
- Worker pool dinâmico (scale por queue depth)
- Postgres read replicas
- Redis cluster
- Migrar para AWS ECS / Kubernetes se Railway limitar
- Custo estimado: ~$200-500/mês

---

## 12. Disaster Recovery

### 12.1 RPO e RTO

| Métrica | Alvo | Estratégia |
|---------|------|-----------|
| **RPO** (Recovery Point Objective) | 24 horas | Backup diário do Postgres |
| **RTO** (Recovery Time Objective) | 1 hora | Redeploy via Railway + restore de backup |

### 12.2 Runbooks

**Cenário: API down**
1. Verificar Railway logs → identificar erro
2. Se crash loop → rollback para deploy anterior no Railway
3. Se migration quebrada → restore do backup pre-migration
4. Notificar usuários via status page

**Cenário: Worker não processa jobs**
1. Verificar Redis connection → `redis-cli ping`
2. Verificar queue depth via Bull Board
3. Se jobs stuck → limpar jobs travados via CLI
4. Se Playwright crash → restart worker container

**Cenário: Breach / leak de credentials**
1. Rotacionar TODOS os secrets imediatamente
2. Invalidar todas as sessões de usuário
3. Revogar API keys do Anthropic
4. Auditar logs de acesso
5. Notificar usuários afetados

---

## 13. Custos Estimados

### 13.1 MVP (primeiros 3 meses)

| Serviço | Plano | Custo/mês |
|---------|-------|-----------|
| Railway | Hobby ($5 base + usage) | ~$15 |
| Vercel | Free | $0 |
| Cloudflare | Free | $0 |
| Sentry | Developer (free, 5K events) | $0 |
| Grafana Cloud | Free (10K series) | $0 |
| GitHub Actions | Free (2000 min/mês) | $0 |
| Domínio (.app) | Anual | ~$3/mês |
| **Total** | | **~$18/mês** |

### 13.2 Growth (após validação)

| Serviço | Plano | Custo/mês |
|---------|-------|-----------|
| Railway | Pro | ~$50-100 |
| Vercel | Pro ($20) | $20 |
| Cloudflare | Free | $0 |
| Sentry | Team ($26/mês) | $26 |
| Grafana Cloud | Free (suficiente) | $0 |
| AWS S3 (currículos) | Usage-based | ~$5 |
| **Total** | | **~$100-150/mês** |

---

## 14. CLAUDE.md Files

Os arquivos CLAUDE.md servem como contexto para o Claude Code trabalhar no projeto:

```markdown
# CLAUDE.md (raiz do monorepo)

## Projeto
AutoApply — Agente autônomo de candidatura a vagas.
Monorepo com pnpm + Turborepo.

## Estrutura
- packages/backend → API Fastify + Workers BullMQ
- packages/frontend → React SPA + TanStack Router
- packages/shared → Types e schemas compartilhados

## Comandos
- `pnpm install` → Instala tudo
- `docker compose up` → Sobe Postgres + Redis
- `pnpm turbo dev` → Dev mode (API + Worker)
- `pnpm turbo test:unit` → Testes unitários
- `pnpm turbo build` → Build de produção

## Padrões
- Clean Architecture no backend (domain → application → infrastructure)
- Feature-based no frontend
- TDD para use cases e domain logic
- Conventional Commits
- ESLint enforça dependency rule entre camadas
```

---

## 15. Próximos Passos (Infra)

### Ordem de execução

1. **Setup monorepo** — pnpm workspace + Turborepo + tsconfigs
2. **Docker Compose** — Postgres + Redis rodando local
3. **Dockerfile multi-stage** — API e Worker buildando
4. **CI básico** — Lint + Type check + Unit tests no GitHub Actions
5. **Railway setup** — Projeto staging com deploy automático
6. **Sentry** — Integração básica no backend
7. **Healthchecks** — Endpoint `/health` com verificação de DB/Redis
8. **Backup** — Script de backup agendado
9. **Monitoring** — Métricas Prometheus + Dashboard Grafana
10. **Frontend deploy** — Vercel com preview deploys
11. **Domínio + Cloudflare** — DNS + SSL + proxy
12. **Security scan** — Docker Scout + pnpm audit no CI

---

## 16. ADRs (Architecture Decision Records)

| # | Decisão | Contexto | Alternativa rejeitada |
|---|---------|----------|----------------------|
| I-001 | Railway, não AWS ECS | Simplicidade para MVP, Docker nativo, custo previsível | AWS ECS (overkill, custo variável, complexidade) |
| I-002 | Railway, não Fly.io | Multi-service no mesmo projeto, DX melhor | Fly.io (bom mas UX mais manual para multi-service) |
| I-003 | Vercel para frontend, não Railway | SPA estático, CDN global grátis, preview deploys | Railway (possível mas menos otimizado para SPA) |
| I-004 | Cloudflare DNS + proxy | SSL grátis, DDoS protection, zero config | Sem proxy (expor Railway direto — sem proteção) |
| I-005 | Pino, não Winston | Structured JSON, nativo Fastify, performance | Winston (mais features, maior, overhead) |
| I-006 | Sentry para errors, Grafana para metrics | Cada tool no que faz melhor | New Relic (all-in-one, caro), Datadog (caro) |
| I-007 | Targets separados API/Worker no Docker | Worker precisa Chromium (400MB), API não | Imagem única (desperdício de 400MB na API) |
| I-008 | Turborepo, não Nx | Mais simples, zero config, cache nativo | Nx (mais features, mais complexo, curva maior) |
| I-009 | GitHub Actions, não CircleCI | Integração nativa GitHub, free tier generoso | CircleCI (bom mas custo extra sem necessidade) |
| I-010 | Conventional Commits obrigatórios | Changelog automático, versionamento semântico | Free-form commits (perde rastreabilidade) |
