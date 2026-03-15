# AutoApply — Arquitetura Backend

> Documento vivo. Fonte da verdade para decisões arquiteturais do projeto.
> Última atualização: 2026-03-03

---

## 1. Visão Geral

AutoApply é um agente autônomo de candidatura a vagas que busca oportunidades, analisa compatibilidade com o perfil do usuário, preenche formulários e envia candidaturas automaticamente.

**Premissa fundamental:** O core do produto é um **orquestrador de agentes com browser automation**, não um CRUD com UI. A API existe para configurar, monitorar e controlar o agente. O frontend é secundário.

### 1.1 Fases do Produto

| Fase | Escopo | Execução |
|------|--------|----------|
| **MVP (local)** | CLI + API local + Worker local | Claude Code SDK direto, Playwright local |
| **Web v1** | SaaS multi-tenant | API Anthropic com key do usuário, Workers isolados |
| **Web v2** | Escala + monetização | Pool de workers, billing, rate limiting por plano |

### 1.2 Stack Definida

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Runtime | Node.js 22+ (LTS) | Ecossistema TS, async nativo, compatível com Playwright |
| Linguagem | TypeScript 5.x (strict mode) | Type-safety, inferência, DX |
| Framework HTTP | Fastify | Performance 2-3x superior ao Express, schema validation nativa com Zod, plugins maduros |
| ORM | Prisma | Type-safe queries, migrations automáticas, compatível com Better Auth |
| Database | PostgreSQL 16 | Relacional, JSONB para dados flexíveis, full-text search nativo |
| Cache/Queue | Redis 7+ | Requerido pelo BullMQ, caching de sessão, rate limiting |
| Queue | BullMQ | Retry com backoff exponencial, rate limiting nativo, concurrency control |
| Auth | Better Auth | Self-hosted, plugin ecosystem, Prisma adapter, type-safe |
| Browser | Playwright | Multi-browser, stealth mode, network interception |
| AI Agent | Claude Code SDK (local) / Anthropic API (web) | Análise de formulários, preenchimento inteligente |
| Validação | Zod | Runtime validation, inferência de tipos TS, composable schemas |
| Logger | Pino | Structured logging (JSON), nativo no Fastify, baixo overhead |
| Docs API | Scalar + OpenAPI 3.1 | Geração automática a partir dos schemas Zod |

### 1.3 Por que Fastify e não Express?

Express é o padrão de facto, mas para este projeto Fastify é superior por três motivos:

1. **Schema validation nativa**: Fastify valida request/response com JSON Schema (ou Zod via plugin). Isso gera a documentação OpenAPI automaticamente — não precisa manter Swagger separado.
2. **Performance**: Em benchmarks consistentes, Fastify processa 2-3x mais requests/segundo que Express. Com workers de browser consumindo recursos pesados, o servidor HTTP precisa ser leve.
3. **Plugin system encapsulado**: Cada plugin tem escopo isolado (encapsulation). Isso evita middleware hell e facilita testes unitários de rotas.

Se discordar, Express funciona também — mas perde auto-geração de docs e performance.

---

## 2. Arquitetura de Camadas (Clean Architecture Adaptada)

### 2.1 Princípio

Aplicamos os **princípios** de Clean Architecture sem dogmatismo:

- **Dependency Rule**: Dependências apontam para dentro (infra → application → domain)
- **Dependency Inversion**: Use cases dependem de interfaces (ports), não de implementações
- **Separation of Concerns**: Cada camada tem responsabilidade clara

**Não aplicamos:**

- Controllers/Presenters formais (Fastify route handlers são suficientes)
- Camada "Frameworks & Drivers" separada (se mistura com infra no contexto Node.js)
- Entities com métodos de persistência (Prisma já abstrai isso)

### 2.2 Estrutura de Diretórios

```
packages/backend/
├── src/
│   ├── domain/                          # Regras de negócio puras (ZERO deps externas)
│   │   ├── entities/
│   │   │   ├── User.ts                  # Tipo + regras (ex: canApply())
│   │   │   ├── JobListing.ts            # Vaga normalizada de qualquer plataforma
│   │   │   ├── Application.ts           # Candidatura (status, tentativas, resultado)
│   │   │   ├── UserProfile.ts           # Perfil do candidato (dados para formulários)
│   │   │   └── Credit.ts                # Saldo + regras de dedução
│   │   ├── value-objects/
│   │   │   ├── Email.ts                 # Validação no construtor
│   │   │   ├── JobPlatform.ts           # 'indeed' | 'linkedin' (union type)
│   │   │   ├── ApplicationStatus.ts     # FSM: pending → applying → success | failed | retrying
│   │   │   └── CreditBalance.ts         # Nunca negativo, regras de dedução
│   │   ├── errors/                      # Domain errors (extends Error, sem HTTP codes)
│   │   │   ├── InsufficientCreditsError.ts
│   │   │   ├── MaxRetriesExceededError.ts
│   │   │   ├── ProfileIncompleteError.ts
│   │   │   └── PlatformUnavailableError.ts
│   │   └── events/                      # Domain events (para desacoplamento)
│   │       ├── ApplicationSubmitted.ts
│   │       ├── ApplicationFailed.ts
│   │       └── CreditDeducted.ts
│   │
│   ├── application/                     # Use Cases (orquestração, depende só de ports)
│   │   ├── use-cases/
│   │   │   ├── search-jobs/
│   │   │   │   ├── SearchJobsUseCase.ts
│   │   │   │   ├── SearchJobsDTO.ts     # Input/Output types
│   │   │   │   └── SearchJobsUseCase.test.ts
│   │   │   ├── apply-to-job/
│   │   │   │   ├── ApplyToJobUseCase.ts
│   │   │   │   ├── ApplyToJobDTO.ts
│   │   │   │   └── ApplyToJobUseCase.test.ts
│   │   │   ├── create-user-profile/
│   │   │   │   ├── CreateUserProfileUseCase.ts
│   │   │   │   └── CreateUserProfileUseCase.test.ts
│   │   │   ├── batch-apply/
│   │   │   │   ├── BatchApplyUseCase.ts # Orquestra múltiplas candidaturas com delay
│   │   │   │   └── BatchApplyUseCase.test.ts
│   │   │   ├── retry-application/
│   │   │   │   ├── RetryApplicationUseCase.ts
│   │   │   │   └── RetryApplicationUseCase.test.ts
│   │   │   └── get-dashboard-stats/
│   │   │       ├── GetDashboardStatsUseCase.ts
│   │   │       └── GetDashboardStatsUseCase.test.ts
│   │   └── ports/                       # Interfaces (contratos)
│   │       ├── IJobSearcher.ts          # search(params) → JobListing[]
│   │       ├── IJobApplier.ts           # apply(job, profile) → ApplicationResult
│   │       ├── IFormAnalyzer.ts         # analyze(url) → FormField[] (Claude)
│   │       ├── IUserRepository.ts
│   │       ├── IApplicationRepository.ts
│   │       ├── ICreditRepository.ts
│   │       ├── IProfileRepository.ts
│   │       └── IQueueService.ts         # enqueue(job) → JobId
│   │
│   ├── infrastructure/                  # Implementações concretas
│   │   ├── database/
│   │   │   ├── prisma/
│   │   │   │   ├── schema.prisma
│   │   │   │   └── migrations/
│   │   │   └── repositories/            # Implementam os ports
│   │   │       ├── PrismaUserRepository.ts
│   │   │       ├── PrismaApplicationRepository.ts
│   │   │       ├── PrismaCreditRepository.ts
│   │   │       └── PrismaProfileRepository.ts
│   │   │
│   │   ├── queue/
│   │   │   ├── BullMQService.ts         # Implementa IQueueService
│   │   │   ├── queues.ts               # Definição das filas (nomes, configs)
│   │   │   └── workers/
│   │   │       ├── ApplicationWorker.ts # Processa candidaturas (processo separado)
│   │   │       └── SearchWorker.ts      # Busca vagas em background
│   │   │
│   │   ├── browser/
│   │   │   ├── BrowserPool.ts           # Pool de instâncias Playwright (max N)
│   │   │   ├── StealthPlugin.ts         # Anti-detecção (headers, fingerprint)
│   │   │   └── adapters/               # Strategy Pattern por plataforma
│   │   │       ├── BasePlatformAdapter.ts   # Classe abstrata com retry logic
│   │   │       ├── IndeedAdapter.ts         # Implementa IJobSearcher + IJobApplier
│   │   │       ├── LinkedInAdapter.ts       # Implementa IJobSearcher + IJobApplier
│   │   │       └── PlatformRegistry.ts      # Factory: platform string → Adapter
│   │   │
│   │   ├── ai/
│   │   │   ├── ClaudeFormAnalyzer.ts    # Implementa IFormAnalyzer
│   │   │   ├── LocalClaudeProvider.ts   # Claude Code SDK (MVP local)
│   │   │   └── ApiClaudeProvider.ts     # Anthropic API (versão web)
│   │   │
│   │   ├── auth/
│   │   │   └── better-auth.ts           # Config Better Auth + Prisma adapter
│   │   │
│   │   └── http/
│   │       ├── server.ts                # Bootstrap Fastify
│   │       ├── plugins/                 # Fastify plugins (auth, cors, rate-limit)
│   │       ├── routes/
│   │       │   ├── auth.routes.ts
│   │       │   ├── jobs.routes.ts       # Busca de vagas
│   │       │   ├── applications.routes.ts
│   │       │   ├── profile.routes.ts
│   │       │   ├── credits.routes.ts
│   │       │   └── dashboard.routes.ts
│   │       └── middlewares/
│   │           ├── error-handler.ts     # Mapeia domain errors → HTTP status
│   │           ├── rate-limiter.ts
│   │           └── credit-guard.ts      # Verifica saldo antes de operações
│   │
│   ├── shared/                          # Cross-cutting concerns
│   │   ├── config/
│   │   │   ├── env.ts                   # Zod schema para env vars
│   │   │   └── constants.ts
│   │   ├── container/
│   │   │   └── di.ts                    # Dependency injection (tsyringe ou manual)
│   │   ├── logger/
│   │   │   └── index.ts                 # Pino config
│   │   └── types/
│   │       └── index.ts                 # Shared types
│   │
│   └── main.ts                          # Entry point (compõe tudo)
│
├── prisma/
│   └── schema.prisma                    # Symlink ou cópia
├── tests/
│   ├── integration/                     # Testa com DB real (testcontainers)
│   ├── e2e/                             # Testa API completa
│   └── fixtures/                        # Dados de teste
├── tsconfig.json
├── vitest.config.ts
├── Dockerfile
├── docker-compose.yml
└── package.json
```

### 2.3 Fluxo de uma Candidatura (Sequência Completa)

```
[Usuário] → POST /api/applications/batch
     │
     ▼
[Route Handler] → Valida input (Zod) → Verifica auth (Better Auth)
     │
     ▼
[CreditGuard Middleware] → Verifica saldo ≥ N vagas
     │
     ▼
[BatchApplyUseCase]
     │  1. Valida perfil completo
     │  2. Reserva N créditos (status: reserved)
     │  3. Para cada vaga:
     │     └── Enfileira job via IQueueService
     │  4. Retorna batchId para tracking
     ▼
[BullMQ Queue: "applications"]
     │  - delay configurável entre jobs (anti-spam)
     │  - attempts: 5
     │  - backoff: { type: 'exponential', delay: 30000 }
     ▼
[ApplicationWorker] (processo separado)
     │  1. Pega instância do BrowserPool
     │  2. Resolve adapter via PlatformRegistry
     │  3. Navega até a vaga
     │  4. Chama IFormAnalyzer (Claude) para entender o formulário
     │  5. Mapeia perfil do usuário → campos do formulário
     │  6. Preenche e submete
     │  7. Verifica confirmação de envio
     │  8. Atualiza ApplicationStatus
     │  9. Deduz crédito (reserved → deducted) ou reverte se falhou
     │ 10. Emite domain event
     ▼
[Resultado]
     ├── ✅ success → CreditDeducted event → status: submitted
     ├── ❌ fail (retriable) → BullMQ retry automático (até 5x)
     └── ❌ fail (fatal) → MaxRetriesExceeded → crédito revertido
```

---

## 3. Design Patterns Aplicados

### 3.1 Strategy Pattern — Platform Adapters

Cada plataforma tem comportamento completamente diferente. O Strategy Pattern isola essa variação.

```typescript
// Port (application layer)
interface IJobSearcher {
  search(params: SearchParams): Promise<JobListing[]>;
  getPlatform(): JobPlatform;
}

interface IJobApplier {
  apply(job: JobListing, profile: UserProfile, page: Page): Promise<ApplicationResult>;
  detectFormFields(url: string, page: Page): Promise<FormField[]>;
}

// Cada adapter implementa ambas interfaces
// IndeedAdapter, LinkedInAdapter, etc.

// Registry (Factory + Strategy)
class PlatformRegistry {
  private adapters: Map<JobPlatform, IJobSearcher & IJobApplier>;

  resolve(platform: JobPlatform): IJobSearcher & IJobApplier {
    const adapter = this.adapters.get(platform);
    if (!adapter) throw new PlatformUnavailableError(platform);
    return adapter;
  }
}
```

### 3.2 Unit of Work — Créditos

Créditos exigem consistência transacional. O fluxo é:

1. **Reserve** — Desconta do saldo disponível, marca como `reserved`
2. **Confirm** — Após sucesso, marca como `deducted`
3. **Rollback** — Após falha definitiva, devolve ao saldo

```typescript
// Dentro do ApplyToJobUseCase
async execute(input: ApplyToJobInput): Promise<ApplicationResult> {
  const creditTx = await this.creditRepo.reserve(input.userId, 1);

  try {
    const result = await this.applier.apply(input.job, input.profile, page);
    await this.creditRepo.confirm(creditTx.id);
    return result;
  } catch (error) {
    await this.creditRepo.rollback(creditTx.id);
    throw error;
  }
}
```

### 3.3 State Machine — Application Status

```
                    ┌─────────────┐
                    │   queued     │
                    └──────┬──────┘
                           │ worker picks up
                           ▼
                    ┌─────────────┐
                    │  applying    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            │            ▼
       ┌────────────┐     │     ┌─────────────┐
       │  submitted  │     │     │   failed     │
       └────────────┘     │     └──────┬──────┘
                          │            │ retry ≤ 5
                          │            ▼
                          │     ┌─────────────┐
                          │     │  retrying    │──┐
                          │     └─────────────┘  │ back to applying
                          │                       │
                          │     ┌─────────────┐  │
                          └────▶│  exhausted   │◀─┘ retry > 5
                                └─────────────┘
```

Implementado como union type (não enum) para exhaustive checking no TS:

```typescript
type ApplicationStatus =
  | 'queued'
  | 'applying'
  | 'submitted'
  | 'failed'
  | 'retrying'
  | 'exhausted';

// Transições válidas (compilador garante)
const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  queued: ['applying'],
  applying: ['submitted', 'failed'],
  failed: ['retrying', 'exhausted'],
  retrying: ['applying'],
  submitted: [],
  exhausted: [],
};
```

### 3.4 Dependency Injection

Para o MVP, DI manual com factory functions é suficiente. `tsyringe` ou `awilix` são opções se a complexidade crescer, mas adicionar container de DI cedo demais é overengineering.

```typescript
// shared/container/di.ts
export function createContainer(config: AppConfig) {
  // Infra
  const prisma = new PrismaClient();
  const redis = new Redis(config.redis);
  const browserPool = new BrowserPool({ maxInstances: config.maxBrowsers });
  const queue = new BullMQService(redis);

  // Repositories
  const userRepo = new PrismaUserRepository(prisma);
  const applicationRepo = new PrismaApplicationRepository(prisma);
  const creditRepo = new PrismaCreditRepository(prisma);
  const profileRepo = new PrismaProfileRepository(prisma);

  // Adapters
  const platformRegistry = new PlatformRegistry();
  platformRegistry.register('indeed', new IndeedAdapter(browserPool));
  platformRegistry.register('linkedin', new LinkedInAdapter(browserPool));

  // AI
  const formAnalyzer = config.isLocal
    ? new LocalClaudeProvider()  // Claude Code SDK
    : new ApiClaudeProvider(config.anthropicApiKey);  // API REST

  // Use Cases
  const searchJobs = new SearchJobsUseCase(platformRegistry);
  const applyToJob = new ApplyToJobUseCase(
    platformRegistry, creditRepo, applicationRepo, formAnalyzer
  );
  const batchApply = new BatchApplyUseCase(
    applyToJob, creditRepo, queue
  );

  return { searchJobs, applyToJob, batchApply, /* ... */ };
}
```

---

## 4. Database Schema

### 4.1 Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ──────────────────────────────────────
// Better Auth tables (gerenciadas pelo plugin)
// ──────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  sessions      Session[]
  accounts      Account[]
  profile       UserProfile?
  credits       CreditBalance?
  applications  Application[]
  searchHistory SearchHistory[]

  @@map("users")
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model Account {
  id                    String    @id @default(cuid())
  userId                String
  accountId             String
  providerId            String
  accessToken           String?
  refreshToken          String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("accounts")
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@map("verifications")
}

// ──────────────────────────────────────
// Domain tables
// ──────────────────────────────────────

model UserProfile {
  id          String   @id @default(cuid())
  userId      String   @unique
  fullName    String
  phone       String?
  location    String?
  linkedinUrl String?
  portfolioUrl String?
  resumeUrl   String?     // URL do arquivo no storage
  resumeData  Json?       // Dados parseados do currículo (para preenchimento)
  skills      String[]    // Array de skills
  experience  Json?       // Histórico profissional estruturado
  education   Json?       // Formação acadêmica estruturada
  preferences Json?       // Preferências de vaga (salário, remoto, etc.)
  isComplete  Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_profiles")
}

model CreditBalance {
  id           String   @id @default(cuid())
  userId       String   @unique
  available    Int      @default(0)  // Créditos disponíveis
  reserved     Int      @default(0)  // Créditos reservados (em processamento)
  totalUsed    Int      @default(0)  // Total já consumido
  plan         Plan     @default(FREE)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user         User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions CreditTransaction[]

  @@map("credit_balances")
}

enum Plan {
  FREE
  PRO
  ENTERPRISE
}

model CreditTransaction {
  id        String            @id @default(cuid())
  balanceId String
  amount    Int               // positivo = crédito, negativo = débito
  type      CreditTransactionType
  status    CreditTransactionStatus
  reason    String?           // "application_to_indeed", "plan_purchase", etc.
  metadata  Json?             // IDs relacionados
  createdAt DateTime          @default(now())

  balance CreditBalance @relation(fields: [balanceId], references: [id])

  @@index([balanceId, createdAt])
  @@map("credit_transactions")
}

enum CreditTransactionType {
  PURCHASE       // Compra de créditos
  GRANT          // Créditos gratuitos (free tier)
  DEBIT          // Uso de crédito (candidatura)
  REFUND         // Devolução (falha na candidatura)
}

enum CreditTransactionStatus {
  PENDING
  RESERVED
  CONFIRMED
  ROLLED_BACK
}

model JobListing {
  id             String      @id @default(cuid())
  externalId     String      // ID na plataforma original
  platform       String      // 'indeed' | 'linkedin'
  title          String
  company        String
  location       String?
  salary         String?     // Range como texto (varia muito entre plataformas)
  description    String?     // Texto completo da vaga
  url            String
  postedAt       DateTime?
  scrapedAt      DateTime    @default(now())
  metadata       Json?       // Dados extras da plataforma
  isActive       Boolean     @default(true)

  applications Application[]

  @@unique([externalId, platform])
  @@index([platform, isActive])
  @@map("job_listings")
}

model Application {
  id            String            @id @default(cuid())
  userId        String
  jobId         String
  batchId       String?           // Agrupamento de candidaturas em lote
  status        ApplicationStatus @default(QUEUED)
  attempts      Int               @default(0)
  maxAttempts   Int               @default(5)
  lastError     String?
  submittedAt   DateTime?
  formData      Json?             // Snapshot dos dados enviados
  metadata      Json?             // Logs, screenshots, etc.
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  user User       @relation(fields: [userId], references: [id])
  job  JobListing @relation(fields: [jobId], references: [id])

  @@unique([userId, jobId])  // Evita candidatura duplicada
  @@index([userId, status])
  @@index([batchId])
  @@map("applications")
}

enum ApplicationStatus {
  QUEUED
  APPLYING
  SUBMITTED
  FAILED
  RETRYING
  EXHAUSTED
}

model SearchHistory {
  id        String   @id @default(cuid())
  userId    String
  query     String
  platform  String
  filters   Json?    // Localização, salário, remoto, etc.
  results   Int      // Quantidade de resultados
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId, createdAt])
  @@map("search_history")
}
```

### 4.2 Decisões de Schema

1. **`resumeData` como JSON**: Currículos têm estrutura variável. JSONB no Postgres permite queries indexadas dentro do JSON sem precisar normalizar em 15 tabelas.

2. **`CreditTransaction` separado de `CreditBalance`**: Audit trail completo. Nunca se perde rastreio de crédito. Balance é calculável a partir das transactions (source of truth), mas mantemos o snapshot para performance.

3. **`@@unique([userId, jobId])`**: Constraint de banco impede candidatura duplicada mesmo em race conditions com múltiplos workers.

4. **`@@unique([externalId, platform])`**: Mesma vaga no Indeed e LinkedIn são registros diferentes (URLs, formulários e dados diferentes).

---

## 5. Queue System — BullMQ

### 5.1 Filas

| Fila | Propósito | Concurrency | Rate Limit |
|------|-----------|-------------|------------|
| `applications` | Envio de candidaturas | 2 por worker | 1 job / 45s (anti-spam) |
| `searches` | Busca de vagas em background | 3 | 1 job / 10s |
| `analysis` | Análise de formulários (Claude) | 5 | Sem limite |

### 5.2 Retry Strategy

```typescript
// Configuração por job na fila "applications"
const JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 30_000,  // 30s, 60s, 120s, 240s, 480s
  },
  removeOnComplete: { count: 1000 },  // Mantém últimos 1000
  removeOnFail: { count: 5000 },       // Mantém últimos 5000 failed
} satisfies JobsOptions;
```

### 5.3 Anti-Spam Delay

BullMQ tem rate limiter nativo no Worker:

```typescript
const worker = new Worker('applications', processor, {
  connection: redis,
  concurrency: 2,
  limiter: {
    max: 1,          // 1 job por vez
    duration: 45_000, // a cada 45 segundos
  },
});
```

Combinado com delay aleatório entre jobs do mesmo batch:

```typescript
// BatchApplyUseCase
for (let i = 0; i < jobs.length; i++) {
  const baseDelay = i * 60_000;  // 1 min entre cada
  const jitter = Math.random() * 30_000;  // +0-30s aleatórios
  await queue.add('apply', jobData, {
    ...JOB_OPTIONS,
    delay: baseDelay + jitter,
  });
}
```

### 5.4 Worker como Processo Separado

O worker **não** roda no mesmo processo que o servidor HTTP. Isso é crítico.

```
docker-compose.yml:
  api:      → src/main.ts (Fastify server)
  worker:   → src/infrastructure/queue/workers/ApplicationWorker.ts
  redis:    → Redis 7
  postgres: → PostgreSQL 16
```

Motivos:

- Browser Playwright consome ~200-400MB RAM por instância
- Crash no worker não derruba a API
- Escalável independentemente (2 APIs + 5 workers)

---

## 6. Browser Automation

### 6.1 Browser Pool

```typescript
class BrowserPool {
  private available: Page[] = [];
  private inUse: Set<Page> = new Set();
  private maxInstances: number;

  async acquire(): Promise<Page> {
    if (this.available.length > 0) {
      const page = this.available.pop()!;
      this.inUse.add(page);
      return page;
    }
    if (this.inUse.size >= this.maxInstances) {
      // Espera uma instância ficar disponível
      return this.waitForAvailable();
    }
    return this.createNewPage();
  }

  async release(page: Page): Promise<void> {
    this.inUse.delete(page);
    await page.goto('about:blank');  // Limpa estado
    this.available.push(page);
  }
}
```

### 6.2 Anti-Detecção

Playwright puro é detectado por sistemas anti-bot. Medidas mínimas:

1. **User-Agent rotation** — Pool de user agents reais
2. **Viewport randomization** — Resoluções comuns (1920x1080, 1366x768, etc.)
3. **Human-like delays** — `page.click()` com delay aleatório antes
4. **Stealth headers** — Remover `navigator.webdriver`, simular plugins

Para MVP, `playwright-extra` + `puppeteer-extra-plugin-stealth` (portado) resolve. Para produção, avaliar serviços como Browserless ou ferramentas cloud de browser.

### 6.3 Fluxo do Claude como Analisador de Formulário

Este é o diferencial. O Claude não preenche campos hardcoded — ele **entende** o formulário:

```
1. Worker navega até a página da vaga
2. Extrai HTML do formulário (innerText + structure)
3. Envia para Claude:
   "Dado este formulário HTML e este perfil de candidato,
    retorne um JSON mapeando cada campo para o valor correto."
4. Claude retorna: { "field_name": "value", "field_selector": "css_selector" }
5. Worker preenche campo por campo com delays humanos
6. Worker submete e verifica confirmação
```

Isso significa que quando o LinkedIn mudar um campo, o sistema se adapta — ao invés de quebrar silenciosamente como um scraper tradicional.

---

## 7. Auth & Credits

### 7.1 Better Auth Config

```typescript
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24,      // Refresh diário
  },
});
```

### 7.2 Sistema de Créditos

| Plano | Créditos/mês | Preço |
|-------|-------------|-------|
| FREE | 10 | R$ 0 |
| PRO | 100 | A definir |
| ENTERPRISE | Ilimitado | A definir |

Regras:

- 1 crédito = 1 candidatura **enviada com sucesso**
- Falha após 5 retries = crédito devolvido
- Créditos do plano FREE não acumulam (reset mensal)
- Créditos comprados avulso não expiram

---

## 8. API Routes (REST + OpenAPI)

### 8.1 Endpoints

```
Auth (Better Auth - rotas automáticas):
  POST   /api/auth/sign-up
  POST   /api/auth/sign-in
  POST   /api/auth/sign-out
  GET    /api/auth/session

Profile:
  GET    /api/profile                    # Retorna perfil do usuário
  PUT    /api/profile                    # Atualiza perfil
  POST   /api/profile/resume             # Upload de currículo (parse automático)
  GET    /api/profile/completeness       # % de completude do perfil

Jobs:
  POST   /api/jobs/search                # Busca vagas (params: query, platform, location, filters)
  GET    /api/jobs/:id                   # Detalhes de uma vaga
  POST   /api/jobs/:id/analyze           # Analisa formulário da vaga (Claude)

Applications:
  POST   /api/applications               # Candidatura individual
  POST   /api/applications/batch         # Candidatura em lote
  GET    /api/applications               # Lista candidaturas (paginado, filtros)
  GET    /api/applications/:id           # Status detalhado
  GET    /api/applications/:id/logs      # Logs de tentativas
  DELETE /api/applications/:id           # Cancela (se ainda na fila)

Credits:
  GET    /api/credits                    # Saldo atual
  GET    /api/credits/transactions       # Histórico de transações
  POST   /api/credits/purchase           # Compra (webhook de pagamento)

Dashboard:
  GET    /api/dashboard/stats            # Resumo: total aplicado, taxa de sucesso, etc.
  GET    /api/dashboard/activity         # Timeline de atividades recentes
```

### 8.2 Padrão de Response

```typescript
// Sucesso
{
  "success": true,
  "data": { /* payload */ },
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 150
  }
}

// Erro
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Saldo insuficiente. Necessário: 5, Disponível: 2",
    "details": { "required": 5, "available": 2 }
  }
}
```

### 8.3 Error Mapping (Domain → HTTP)

```typescript
// middlewares/error-handler.ts
const ERROR_MAP: Record<string, { status: number; code: string }> = {
  InsufficientCreditsError: { status: 402, code: 'INSUFFICIENT_CREDITS' },
  ProfileIncompleteError:   { status: 422, code: 'PROFILE_INCOMPLETE' },
  MaxRetriesExceededError:  { status: 500, code: 'MAX_RETRIES_EXCEEDED' },
  PlatformUnavailableError: { status: 503, code: 'PLATFORM_UNAVAILABLE' },
};
```

---

## 9. Testing Strategy

### 9.1 Pirâmide de Testes

```
              ╱╲
             ╱ E2E ╲           ~10 testes (fluxos críticos)
            ╱────────╲
           ╱Integration╲       ~30 testes (repos + API)
          ╱──────────────╲
         ╱   Unit Tests    ╲   ~100+ testes (use cases, domain)
        ╱────────────────────╲
```

### 9.2 O Que Testar com TDD

| Camada | Tipo | Framework | Exemplo |
|--------|------|-----------|---------|
| Domain entities | Unit | Vitest | `CreditBalance.deduct()` lança erro se saldo < 0 |
| Value objects | Unit | Vitest | `Email("invalid")` lança `InvalidEmailError` |
| Use cases | Unit (mocked ports) | Vitest | `ApplyToJobUseCase` deduz crédito no sucesso, reverte na falha |
| State transitions | Unit | Vitest | `ApplicationStatus` só permite transições válidas |
| Queue retry logic | Unit | Vitest | Backoff exponencial calcula delays corretos |
| Repositories | Integration | Vitest + Testcontainers | `PrismaApplicationRepo.findByUser()` com Postgres real |
| API routes | Integration | Vitest + Supertest | `POST /api/applications` retorna 402 sem créditos |
| Fluxo completo | E2E | Playwright test | Login → Buscar → Aplicar → Verificar status |

### 9.3 O Que NÃO Testar com TDD

- **Adapters de plataforma** (Indeed, LinkedIn): Usam contract tests. O HTML muda toda semana — testes unitários quebrariam constantemente. Em vez disso, mantemos fixtures de HTML e verificamos que o adapter parseia corretamente.
- **Componentes visuais**: Storybook + visual regression (quando o front existir).
- **Integração com Claude**: Mock do IFormAnalyzer nos testes. Testes reais com Claude ficam em um suite separado (slow tests) rodando semanalmente.

### 9.4 Configuração Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['src/infrastructure/**', 'src/shared/config/**'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    // Separar suites
    typecheck: { enabled: true },
  },
});
```

---

## 10. Monorepo Structure

```
autoapply/
├── packages/
│   ├── backend/                    # API + Workers (este documento)
│   ├── frontend/                   # TanStack Router + React (futuro)
│   ├── shared/                     # Types compartilhados (DTOs, enums)
│   │   └── src/
│   │       ├── types/
│   │       │   ├── api.ts          # Request/Response types
│   │       │   ├── jobs.ts         # JobListing, SearchParams
│   │       │   └── credits.ts      # CreditBalance, Plan
│   │       └── schemas/
│   │           ├── profile.schema.ts  # Zod schemas usados em ambos
│   │           └── search.schema.ts
│   └── cli/                        # CLI wrapper para uso local (futuro)
│
├── CLAUDE.md                       # Contexto global do projeto para Claude Code
├── packages/backend/CLAUDE.md      # Contexto específico do backend
├── packages/frontend/CLAUDE.md     # Contexto específico do frontend
│
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Lint + Type check + Test
│       ├── deploy-api.yml          # Deploy backend
│       └── deploy-web.yml          # Deploy frontend
│
├── docker-compose.yml              # Dev environment (Postgres + Redis)
├── docker-compose.prod.yml         # Produção
├── turbo.json                      # Turborepo config
├── package.json                    # Workspace root
├── pnpm-workspace.yaml
├── .eslintrc.cjs
├── .prettierrc
├── tsconfig.base.json
└── README.md
```

### 10.1 Tooling do Monorepo

| Ferramenta | Propósito | Config |
|-----------|-----------|--------|
| **pnpm** | Package manager | Workspaces, hoisting strict |
| **Turborepo** | Build orchestration | Cache remoto, parallel tasks |
| **TypeScript** | Project references | `tsconfig.base.json` + extends por package |

---

## 11. Linters & Code Quality

### 11.1 ESLint

```javascript
// .eslintrc.cjs
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json', './packages/*/tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier', // Desativa regras conflitantes
  ],
  rules: {
    // Strict
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': ['warn', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
    }],
    '@typescript-eslint/strict-boolean-expressions': 'error',
    '@typescript-eslint/no-floating-promises': 'error',

    // Import order
    'import/order': ['error', {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling'],
      'newlines-between': 'always',
      alphabetize: { order: 'asc' },
    }],
    'import/no-cycle': 'error',  // Previne dependências circulares

    // Clean Architecture enforcement
    'import/no-restricted-paths': ['error', {
      zones: [
        // Domain não pode importar de application ou infrastructure
        { target: './src/domain', from: './src/application', message: 'Domain cannot depend on Application' },
        { target: './src/domain', from: './src/infrastructure', message: 'Domain cannot depend on Infrastructure' },
        // Application não pode importar de infrastructure
        { target: './src/application', from: './src/infrastructure', message: 'Application cannot depend on Infrastructure' },
      ],
    }],
  },
};
```

Nota: A regra `import/no-restricted-paths` **enforça a dependency rule** da Clean Architecture no nível do linter. Se alguém tentar importar Prisma dentro de um use case, o CI quebra.

### 11.2 Prettier

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### 11.3 Husky + lint-staged

```json
// package.json (root)
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml}": ["prettier --write"]
  }
}
```

### 11.4 Commitlint (Conventional Commits)

```
type(scope): description

feat(backend): add credit reservation flow
fix(worker): handle timeout on LinkedIn adapter
test(use-cases): add ApplyToJob edge cases
refactor(domain): extract CreditBalance value object
chore(ci): add Postgres to test pipeline
docs(api): update OpenAPI spec for batch endpoint
```

---

## 12. CI/CD

### 12.1 GitHub Actions — CI

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint          # ESLint
      - run: pnpm turbo type-check    # tsc --noEmit
      - run: pnpm turbo format:check  # Prettier check

  test:
    runs-on: ubuntu-latest
    needs: quality
    services:
      postgres:
        image: postgres:16
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
        image: redis:7
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo test:unit
      - run: pnpm turbo test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/autoapply_test
          REDIS_URL: redis://localhost:6379

      - uses: codecov/codecov-action@v4
        with:
          files: packages/backend/coverage/lcov.info
```

### 12.2 Deploy Strategy

| Ambiente | Trigger | Infra |
|----------|---------|-------|
| **Dev** | Push to `develop` | Docker Compose local ou Railway |
| **Staging** | PR merge to `main` | Railway ou Render |
| **Prod** | Tag release `v*` | Railway / Fly.io / AWS ECS |

Para o MVP local, não precisa de deploy — roda direto com `docker compose up`.

---

## 13. Environment Variables

```bash
# .env.example

# ─── Database ────────────────────────
DATABASE_URL=postgresql://user:pass@localhost:5432/autoapply
REDIS_URL=redis://localhost:6379

# ─── Better Auth ─────────────────────
BETTER_AUTH_SECRET=your-secret-here-min-32-chars
BETTER_AUTH_URL=http://localhost:3001

# ─── OAuth Providers ─────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# ─── Anthropic (versão web) ─────────
ANTHROPIC_API_KEY=

# ─── App ─────────────────────────────
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:3000

# ─── Browser ─────────────────────────
MAX_BROWSER_INSTANCES=3
BROWSER_HEADLESS=true

# ─── Queue ───────────────────────────
APPLICATION_DELAY_MS=45000
MAX_APPLICATION_RETRIES=5
```

---

## 14. Docker Compose (Dev)

```yaml
# docker-compose.yml
version: '3.8'

services:
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

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redisdata:/data

  api:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
      target: development
    ports:
      - '3001:3001'
    environment:
      DATABASE_URL: postgresql://autoapply:autoapply_dev@postgres:5432/autoapply
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./packages/backend/src:/app/packages/backend/src
    command: pnpm --filter backend dev

  worker:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
      target: development
    environment:
      DATABASE_URL: postgresql://autoapply:autoapply_dev@postgres:5432/autoapply
      REDIS_URL: redis://redis:6379
      MAX_BROWSER_INSTANCES: 2
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./packages/backend/src:/app/packages/backend/src
    command: pnpm --filter backend dev:worker

volumes:
  pgdata:
  redisdata:
```

---

## 15. Segurança

### 15.1 Checklist

- [ ] **HTTPS everywhere** (TLS termination no reverse proxy)
- [ ] **Rate limiting** por IP e por usuário (Fastify plugin)
- [ ] **CORS** restrito ao domínio do frontend
- [ ] **Helmet** headers de segurança
- [ ] **Input validation** em todas as rotas (Zod schemas)
- [ ] **SQL injection** — Prisma parametriza por padrão
- [ ] **XSS** — Não renderiza HTML do usuário
- [ ] **CSRF** — Better Auth inclui proteção
- [ ] **Secrets** — Nunca em código, sempre env vars
- [ ] **Dependency audit** — `pnpm audit` no CI
- [ ] **API key do Anthropic** — Nunca exposta no frontend. Na versão web, o usuário fornece a key que é encriptada em repouso (AES-256-GCM) e decriptada apenas no worker
- [ ] **Credenciais de plataforma** — Se LinkedIn/Indeed exigir login, credenciais encriptadas e isoladas por usuário
- [ ] **Browser isolation** — Workers rodam em containers com capabilities limitadas

### 15.2 Rate Limiting por Plano

```typescript
const RATE_LIMITS: Record<Plan, { max: number; window: string }> = {
  FREE:       { max: 30,  window: '15 minutes' },
  PRO:        { max: 100, window: '15 minutes' },
  ENTERPRISE: { max: 500, window: '15 minutes' },
};
```

---

## 16. Próximos Passos

### Backend (ordenado por prioridade)

1. **Setup monorepo** — pnpm workspace + Turborepo + tsconfig base
2. **Docker Compose** — Postgres + Redis rodando
3. **Prisma schema + migrations** — Criar o banco
4. **Better Auth** — Sign up/in/out funcional
5. **Domain layer** — Entities, value objects, errors
6. **Use cases** — SearchJobs, ApplyToJob (com TDD)
7. **BullMQ workers** — Fila de candidaturas com retry
8. **Platform adapters** — Indeed adapter (mais simples primeiro)
9. **Claude integration** — Análise de formulários
10. **LinkedIn adapter** — Mais complexo (auth, anti-bot)
11. **API routes** — Expor tudo via REST
12. **Credits system** — Reserva/confirmação/rollback

### Frontend (futuro)

- TanStack Router + React + Tailwind + shadcn/ui + Zustand
- Storybook para componentes
- Better Auth UI para telas de auth
- Dashboard com status real-time (polling ou SSE)

### Infraestrutura (futuro)

- CI/CD completo
- Deploy staging/prod
- Monitoring (Sentry, Prometheus)
- Logging centralizado
