# AutoApply — Arquitetura de Segurança

> Documento vivo. Fonte da verdade para decisões de segurança, compliance e proteção de dados.
> Complementar a `BACKEND-ARCHITECTURE.md`, `FRONTEND-ARCHITECTURE.md` e `INFRA-ARCHITECTURE.md`.
> Última atualização: 2026-03-05

---

## 1. Visão Geral

O AutoApply lida com **três classes de dados sensíveis** que exigem atenção especial:

1. **Dados pessoais dos usuários** — Nome, email, telefone, endereço, histórico profissional, formação (LGPD se aplica)
2. **Currículos** — Documentos que contêm o conjunto mais denso de PII (Personally Identifiable Information) que um usuário pode fornecer
3. **Credenciais de terceiros** — API keys do Anthropic, e potencialmente credenciais de plataformas (LinkedIn, Indeed)

A postura de segurança é **defense in depth**: múltiplas camadas independentes de proteção. Se uma camada falhar, as outras ainda protegem.

### 1.1 Princípios Fundamentais

| Princípio | Significado prático |
|-----------|-------------------|
| **Least Privilege** | Cada serviço, usuário e processo tem apenas as permissões mínimas necessárias |
| **Defense in Depth** | Múltiplas camadas: Cloudflare → Rate limit → Auth → Validação → Sanitização → DB constraints |
| **Zero Trust** | Não confiar em nenhum input — todo dado externo é validado (Zod schemas) |
| **Fail Secure** | Em caso de erro, o sistema nega acesso ao invés de permitir |
| **Data Minimization** | Coletar e armazenar apenas dados necessários para o funcionamento |
| **Encrypt in Transit & at Rest** | HTTPS para tráfego, AES-256-GCM para dados sensíveis no banco |

---

## 2. Threat Model

### 2.1 Atores de Ameaça

| Ator | Motivação | Capacidade | Prioridade |
|------|-----------|------------|------------|
| **Script kiddie** | Diversão, vandalismo | Ferramentas automatizadas, scanners | Média |
| **Competitor** | Scraping de funcionalidades, DoS | Engenharia reversa, bots | Média |
| **Malicious user** | Abuse do sistema (spam de candidaturas, credit fraud) | Conta válida, manipulação de requests | Alta |
| **Plataformas (LinkedIn/Indeed)** | Bloqueio de bots, ações legais | Detecção de automação, ban de IP | Alta |
| **Insider (dev comprometido)** | Acesso a secrets, dados | Acesso ao código e infra | Baixa (equipe pequena) |
| **Supply chain attacker** | Backdoor via dependência | Packages maliciosos no npm | Média |

### 2.2 Assets e Classificação

| Asset | Classificação | Impacto se comprometido |
|-------|--------------|------------------------|
| Banco de dados (Postgres) | **Crítico** | Exposição de PII de todos os usuários |
| Currículos (S3/filesystem) | **Crítico** | Documentos completos com dados pessoais |
| API keys Anthropic dos usuários | **Crítico** | Uso indevido da API, custo financeiro |
| Credenciais de sessão | **Alto** | Impersonação de usuários |
| Código-fonte | **Alto** | Exposição de lógica de negócio e vulnerabilidades |
| Logs de aplicação | **Médio** | Podem conter metadados sensíveis |
| Métricas (Prometheus) | **Baixo** | Informações operacionais |

### 2.3 Superfícies de Ataque

```
                    INTERNET
                       │
         ┌─────────────┼──────────────┐
         ▼             ▼              ▼
    ┌─────────┐  ┌──────────┐  ┌──────────┐
    │ Frontend │  │ API REST │  │ Webhook  │
    │  (SPA)   │  │ (Fastify)│  │ (pagto)  │
    └────┬────┘  └────┬─────┘  └────┬─────┘
         │            │             │
    ── XSS ──    ── Injection ──  ── Spoof ──
    ── CSRF ──   ── Auth bypass ─ ── Replay ─
    ── Click ──  ── Rate abuse ── ── MITM ───
         │            │             │
         └────────────┼─────────────┘
                      ▼
              ┌──────────────┐
              │   Backend    │
              │  (Business)  │
              └──────┬───────┘
                     │
         ── Credit fraud ──
         ── Privilege escalation ──
         ── Data exfiltration ──
                     │
              ┌──────┼──────┐
              ▼      ▼      ▼
          Postgres  Redis  Browser
          ── SQLi ── ── Cmd inj ── ── Escape ──
```

---

## 3. OWASP Top 10:2025 — Mapeamento

Cada item do OWASP Top 10:2025 mapeado para o contexto do AutoApply com mitigações específicas.

### A01:2025 — Broken Access Control

**Risco no AutoApply**: Usuário A acessa candidaturas do Usuário B. Usuário free acessa features de plano PRO.

**Mitigações**:

```typescript
// 1. Verificação de ownership em TODA query que envolve dados de usuário
// Nunca confiar no ID vindo do frontend — sempre derivar do session token

// ❌ ERRADO — userId vem do request body (manipulável)
app.get('/api/applications', async (req) => {
  return db.application.findMany({ where: { userId: req.body.userId } });
});

// ✅ CORRETO — userId derivado da sessão autenticada
app.get('/api/applications', async (req) => {
  const session = await auth.api.getSession({ headers: req.headers });
  return db.application.findMany({ where: { userId: session.user.id } });
});

// 2. Middleware de autorização por plano
function requirePlan(minimumPlan: Plan) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const userPlan = await getUserPlan(req.userId);
    if (planLevel(userPlan) < planLevel(minimumPlan)) {
      reply.status(403).send({
        success: false,
        error: { code: 'PLAN_REQUIRED', message: `Requer plano ${minimumPlan}` },
      });
    }
  };
}

// 3. Row-level security via Prisma middleware
prisma.$use(async (params, next) => {
  // Garantir que queries sempre filtram por userId
  if (['Application', 'UserProfile', 'CreditBalance'].includes(params.model)) {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = { ...params.args.where, userId: currentUserId };
    }
  }
  return next(params);
});
```

**Testes**:
- [ ] Usuário A não consegue acessar `GET /api/applications/:id` de Usuário B (retorna 404, não 403 — evita enumeration)
- [ ] Usuário free recebe 403 ao tentar batch apply (feature PRO)
- [ ] Token expirado retorna 401, não dados parciais

### A02:2025 — Security Misconfiguration

**Risco no AutoApply**: Headers de segurança ausentes, CORS permissivo, debug mode em produção, Postgres exposto.

**Mitigações**:

```typescript
// Helmet para headers de segurança
import helmet from '@fastify/helmet';

app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind precisa
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", process.env.CORS_ORIGIN],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-site' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

// Desabilitar fingerprinting do servidor
app.register(helmet, { hidePoweredBy: true });

// Validação de env vars na inicialização (fail fast)
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  DATABASE_URL: z.string().startsWith('postgresql://'),
  REDIS_URL: z.string().startsWith('redis://'),
  BETTER_AUTH_SECRET: z.string().min(32),
  SENTRY_DSN: z.string().url().optional(),
  CORS_ORIGIN: z.string().url(),
});

// Se alguma env var estiver errada, a aplicação NÃO inicia
export const env = envSchema.parse(process.env);
```

**Checklist de configuração**:
- [ ] `NODE_ENV=production` em produção (nunca `development`)
- [ ] Postgres sem endpoint público (apenas rede interna Railway)
- [ ] Redis sem endpoint público + senha configurada
- [ ] CORS restrito ao domínio do frontend (não `*`)
- [ ] Error responses não expõem stack traces em produção
- [ ] Nenhuma rota de debug/admin exposta sem auth

### A03:2025 — Software Supply Chain Failures

**Risco no AutoApply**: Dependência npm comprometida injeta malware no build.

**Mitigações**:

```yaml
# 1. Audit no CI (GitHub Actions)
- name: Audit dependencies
  run: pnpm audit --audit-level=high
  # Falha o CI se houver vulnerabilidade high ou critical

# 2. Lock file sempre commitado
# pnpm-lock.yaml garante versões exatas

# 3. Renovate/Dependabot para atualizações automáticas
# .github/renovate.json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "packageRules": [
    {
      "matchUpdateTypes": ["major"],
      "labels": ["breaking-change"],
      "automerge": false
    },
    {
      "matchUpdateTypes": ["minor", "patch"],
      "automerge": true,
      "automergeType": "pr"
    }
  ],
  "vulnerabilityAlerts": { "enabled": true }
}
```

```bash
# 4. Verificar integridade dos pacotes
pnpm install --frozen-lockfile  # Falha se lock file divergir

# 5. Imagens Docker com tags fixas (nunca :latest em prod)
FROM node:22.12.0-alpine  # ✅ Tag fixa
FROM node:latest           # ❌ Nunca em produção
```

### A04:2025 — Cryptographic Failures

**Risco no AutoApply**: API keys do Anthropic armazenadas em plain text, senhas com hash fraco, comunicação sem TLS.

**Mitigações**:

```typescript
// 1. Encriptação de API keys do Anthropic (AES-256-GCM)
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  // Formato: iv:authTag:encrypted (tudo em hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Uso: salvar API key encriptada
await db.user.update({
  where: { id: userId },
  data: { anthropicApiKey: encrypt(rawApiKey) },
});

// Uso: decriptar apenas no Worker (nunca expor ao frontend)
const apiKey = decrypt(user.anthropicApiKey);
```

```typescript
// 2. Senhas — Better Auth usa bcrypt por padrão (custo 10)
// Não implementar hashing próprio

// 3. TLS em tudo
// - Cloudflare termina TLS para o frontend
// - Railway provê TLS para conexões internas
// - DATABASE_URL com ?sslmode=require em produção
```

### A05:2025 — Injection

**Risco no AutoApply**: SQL injection via filtros de busca, XSS via dados de vagas exibidos no frontend.

**Mitigações**:

```typescript
// 1. Prisma parametriza queries automaticamente — SQL injection mitigado
// NÃO usar $queryRaw com interpolação de strings
// ❌ NUNCA
const results = await prisma.$queryRaw`SELECT * FROM users WHERE name = ${userInput}`;
// ✅ Prisma ORM
const results = await prisma.user.findMany({ where: { name: userInput } });

// 2. Validação de input com Zod em TODA rota
const searchSchema = z.object({
  q: z.string().max(200).trim(),
  platform: z.enum(['indeed', 'linkedin', 'all']),
  location: z.string().max(100).trim().optional(),
  salaryMin: z.number().int().min(0).max(1_000_000).optional(),
  salaryMax: z.number().int().min(0).max(1_000_000).optional(),
  page: z.number().int().min(1).max(100),
});

// 3. XSS — React escapa HTML por padrão
// NÃO usar dangerouslySetInnerHTML com dados de vagas
// Se precisar renderizar HTML de descrição de vaga, usar DOMPurify:
import DOMPurify from 'dompurify';
const safeHTML = DOMPurify.sanitize(jobDescription);

// 4. NoSQL injection no Redis — BullMQ usa comandos parametrizados
// Não construir comandos Redis com interpolação de strings
```

### A06:2025 — Insecure Design

**Risco no AutoApply**: Ausência de rate limiting permite spam de candidaturas. Ausência de confirmação permite ações destrutivas acidentais.

**Mitigações**:

- Rate limiting por plano (definido no backend doc, seção 15.2)
- Confirmação de ações destrutivas (batch apply requer UI confirmation)
- Créditos como mecanismo de controle econômico (limita abuso por design)
- Estado de máquina para ApplicationStatus (transições inválidas rejeitadas)
- Delay anti-spam obrigatório entre candidaturas (45s + jitter)

### A07:2025 — Identification and Authentication Failures

**Risco no AutoApply**: Brute force de login, session fixation, token theft.

**Mitigações**:

```typescript
// Better Auth já implementa:
// - Bcrypt para hashing de senhas
// - Session tokens com expiração configurável
// - CSRF protection nativa
// - Rate limiting em endpoints de auth

// Configurações adicionais:
export const auth = betterAuth({
  // ...
  rateLimit: {
    window: 60,       // 1 minuto
    max: 10,           // Máximo 10 tentativas de login por minuto
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,  // 7 dias
    updateAge: 60 * 60 * 24,       // Refresh diário
  },
  account: {
    accountLinking: { enabled: true },  // Vincular OAuth a email existente
  },
});

// Adicional: bloquear conta após 10 tentativas falhas consecutivas
// (implementar como middleware customizado)
```

### A08:2025 — Software and Data Integrity Failures

**Risco no AutoApply**: CI/CD comprometido executa código malicioso no deploy.

**Mitigações**:
- GitHub Actions com `permissions` mínimas por job
- Secrets acessíveis apenas por environments protegidos (staging, production)
- Branch protection rules: require PR review + CI passing para merge em `main`
- Signed commits (recomendado, não obrigatório para MVP)

### A09:2025 — Security Logging and Alerting Failures

**Risco no AutoApply**: Breach não detectado por meses por falta de logs/alertas.

**Mitigações** (detalhado no doc de Infra, seção 7):
- Pino structured logging com redaction de PII
- Sentry para exceções com contexto de usuário
- Alertas configurados para: login failures spike, 5xx rate, unusual credit consumption
- Audit log para ações sensíveis (seção 5 deste documento)

### A10:2025 — Mishandling of Exceptional Conditions

**Risco no AutoApply**: Erro no Playwright expõe informação interna. Falha no Redis retorna dados parciais ao invés de erro.

**Mitigações**:

```typescript
// 1. Error handler global que NUNCA expõe detalhes internos em produção
app.setErrorHandler((error, request, reply) => {
  // Log completo internamente
  logger.error({ err: error, requestId: request.id }, 'unhandled error');
  // Sentry captura com contexto
  Sentry.captureException(error, { extra: { requestId: request.id } });

  // Response ao cliente: NUNCA o stack trace
  const statusCode = error.statusCode || 500;
  reply.status(statusCode).send({
    success: false,
    error: {
      code: statusCode === 500 ? 'INTERNAL_ERROR' : error.code,
      message: statusCode === 500
        ? 'Erro interno. Tente novamente.'  // Genérico em produção
        : error.message,
      // details NUNCA em produção
      ...(env.NODE_ENV === 'development' && { details: error.stack }),
    },
  });
});

// 2. Fail secure — Redis down não retorna dados parciais
async function getSession(token: string) {
  try {
    return await redis.get(`session:${token}`);
  } catch (error) {
    logger.error({ err: error }, 'redis.session.failed');
    // Fail secure: negar acesso ao invés de permitir
    throw new AuthenticationError('Session service unavailable');
  }
}
```

---

## 4. Proteção de Dados (LGPD)

O AutoApply processa dados de usuários brasileiros, portanto a LGPD (Lei Geral de Proteção de Dados, Lei 13.709/2018) se aplica integralmente.

### 4.1 Dados Coletados e Base Legal

| Dado | Categoria LGPD | Base Legal (Art. 7) | Retenção |
|------|---------------|---------------------|----------|
| Nome, email | Dado pessoal | Execução de contrato | Enquanto conta ativa |
| Telefone, endereço | Dado pessoal | Consentimento | Enquanto conta ativa |
| Currículo (PDF/DOCX) | Dado pessoal (pode conter sensível) | Consentimento explícito | Enquanto conta ativa + 30 dias após exclusão |
| Histórico profissional | Dado pessoal | Execução de contrato | Enquanto conta ativa |
| Skills, formação | Dado pessoal | Execução de contrato | Enquanto conta ativa |
| Histórico de candidaturas | Dado pessoal | Execução de contrato | Enquanto conta ativa |
| Logs de acesso (IP, user-agent) | Dado pessoal | Interesse legítimo | 90 dias |
| Dados de pagamento | Dado pessoal | Execução de contrato | Conforme obrigação fiscal (5 anos) |

### 4.2 Direitos do Titular (Art. 18 LGPD)

Cada direito mapeado para funcionalidade no sistema:

| Direito | Implementação |
|---------|---------------|
| **Confirmação de tratamento** | Endpoint `GET /api/privacy/data-summary` retorna quais dados processamos |
| **Acesso aos dados** | Endpoint `GET /api/privacy/export` retorna todos os dados do usuário em JSON |
| **Correção** | Tela de perfil permite editar todos os dados pessoais |
| **Anonimização/bloqueio/eliminação** | Endpoint `DELETE /api/privacy/account` executa exclusão completa |
| **Portabilidade** | Export em JSON padronizado via `GET /api/privacy/export` |
| **Eliminação** | Exclusão de conta remove todos os dados, currículos e histórico |
| **Informação sobre compartilhamento** | Privacy policy lista todos os processadores (Railway, Anthropic, etc.) |
| **Revogação de consentimento** | Configurações da conta permitem revogar consentimento específico |

### 4.3 Implementação de Exclusão de Conta

```typescript
// Endpoint de exclusão de conta (Art. 18, IV e VI)
async function deleteUserAccount(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. Deletar currículo do storage
    const profile = await tx.userProfile.findUnique({ where: { userId } });
    if (profile?.resumeUrl) {
      await deleteFromStorage(profile.resumeUrl);
    }

    // 2. Deletar dados em cascata (ordem importa por FK constraints)
    await tx.searchHistory.deleteMany({ where: { userId } });
    await tx.application.deleteMany({ where: { userId } });
    await tx.creditTransaction.deleteMany({
      where: { balance: { userId } },
    });
    await tx.creditBalance.delete({ where: { userId } });
    await tx.userProfile.delete({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });

    // 3. Anonimizar o user (manter registro para integridade referencial)
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@anonymous.local`,
        name: null,
        image: null,
        emailVerified: false,
      },
    });

    // 4. Log de auditoria (sem PII)
    logger.info({ userId: '[REDACTED]', action: 'account_deleted' }, 'gdpr.delete');
  });
}
```

### 4.4 Privacy Policy (Requisitos Mínimos)

O AutoApply precisa de uma Privacy Policy acessível que inclua:

- [ ] Identidade do controlador e contato do DPO (encarregado)
- [ ] Finalidade de cada tratamento de dados
- [ ] Base legal para cada tratamento
- [ ] Lista de dados coletados
- [ ] Tempo de retenção por tipo de dado
- [ ] Direitos do titular e como exercê-los
- [ ] Lista de processadores (sub-processors): Railway, Anthropic, Vercel, Sentry
- [ ] Informação sobre transferência internacional de dados (Railway/Anthropic são EUA)
- [ ] Procedimento em caso de incidente de segurança

### 4.5 Consentimento para Currículo

Currículos podem conter dados sensíveis (Art. 5, II LGPD) — saúde, religião, orientação política em alguns formatos. O upload exige consentimento explícito:

```typescript
// Frontend: checkbox obrigatório antes do upload
// "Autorizo o processamento dos dados contidos no meu currículo
//  para fins de preenchimento automático de formulários de candidatura
//  em plataformas de emprego. Entendo que posso revogar este
//  consentimento a qualquer momento."

// Backend: registrar consentimento
await db.consent.create({
  data: {
    userId,
    type: 'RESUME_PROCESSING',
    grantedAt: new Date(),
    ip: request.ip,
    userAgent: request.headers['user-agent'],
  },
});
```

---

## 5. Audit Trail

### 5.1 Eventos Auditáveis

Toda ação sensível gera um registro de auditoria imutável:

```typescript
// infrastructure/audit/audit-log.ts
interface AuditEvent {
  id: string;
  timestamp: Date;
  userId: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip: string;
  userAgent: string;
}

type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.password_changed'
  | 'profile.updated'
  | 'profile.resume_uploaded'
  | 'profile.resume_deleted'
  | 'application.created'
  | 'application.batch_created'
  | 'application.cancelled'
  | 'credit.purchased'
  | 'credit.consumed'
  | 'credit.refunded'
  | 'account.api_key_stored'
  | 'account.api_key_rotated'
  | 'account.deleted'
  | 'admin.user_suspended'
  | 'privacy.data_exported'
  | 'privacy.consent_granted'
  | 'privacy.consent_revoked';
```

### 5.2 Storage de Audit Logs

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  resource  String
  resourceId String?
  metadata  Json?
  ip        String
  userAgent String
  createdAt DateTime @default(now())

  // Sem FK para User — logs sobrevivem à exclusão de conta
  // userId é para referência, não integridade referencial

  @@index([userId, createdAt])
  @@index([action, createdAt])
  @@map("audit_logs")
}
```

Regras:
- Audit logs são **append-only** — nunca deletados, nunca atualizados
- Retenção: 1 ano (configurável por regulação)
- PII nos logs é minimizado (userId sem nome/email)
- IP é armazenado para compliance mas pode ser anonimizado após 90 dias

---

## 6. Autenticação e Sessões

### 6.1 Fluxo de Autenticação

```
[Usuário] → POST /api/auth/sign-in (email + senha)
     │
     ▼
[Better Auth] → Verifica bcrypt hash → Cria session token
     │
     ▼
[Session] → Armazenada no Postgres (não JWT)
     │
     ├── Cookie httpOnly, Secure, SameSite=Lax
     └── Expira em 7 dias, refresh diário
     │
     ▼
[Requests subsequentes] → Cookie enviado automaticamente
     │
     ▼
[Middleware Auth] → Valida session no banco
     │
     ├── ✅ Válida → Continua para a rota
     └── ❌ Inválida/Expirada → 401
```

### 6.2 Por que Sessions e não JWT?

JWTs stateless parecem atraentes, mas para este projeto sessions no banco são superiores:

1. **Revogação imediata**: Se uma conta é comprometida, invalidamos todas as sessões instantaneamente. JWTs stateless não permitem isso sem uma blacklist (que é basicamente uma sessão).
2. **Sem secret rotation complexa**: JWT requer rotação de signing keys. Sessions só precisam do session ID aleatório.
3. **Menor superfície de ataque**: JWT no localStorage é vulnerável a XSS. Cookie httpOnly + Secure + SameSite é mais seguro.
4. **Better Auth usa sessions por padrão**: Não lutar contra a lib.

### 6.3 Proteção de Sessão

```typescript
// Configuração de cookie de sessão
{
  httpOnly: true,      // JavaScript no browser NÃO acessa
  secure: true,        // Apenas HTTPS
  sameSite: 'lax',     // Protege contra CSRF básico
  path: '/',
  maxAge: 60 * 60 * 24 * 7,  // 7 dias
  domain: '.autoapply.app',   // Subdomínios compartilham sessão
}
```

---

## 7. Rate Limiting

### 7.1 Camadas de Rate Limiting

```
Camada 1: Cloudflare (IP-based, DDoS protection)
     │
     ▼
Camada 2: Fastify rate-limit (por IP e por usuário autenticado)
     │
     ▼
Camada 3: BullMQ limiter (por operação de negócio)
     │
     ▼
Camada 4: Credit system (limite econômico por plano)
```

### 7.2 Configuração por Rota

```typescript
// Rate limiting com @fastify/rate-limit
import rateLimit from '@fastify/rate-limit';

app.register(rateLimit, {
  global: true,
  max: 100,           // 100 req por janela global
  timeWindow: '1 minute',
  keyGenerator: (req) => {
    // Usar userId se autenticado, IP se não
    return req.userId || req.ip;
  },
  errorResponseBuilder: (req, context) => ({
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Muitas requisições. Tente novamente em breve.',
      retryAfter: context.after,
    },
  }),
});

// Overrides por rota
const ROUTE_LIMITS = {
  // Auth — mais restritivo (brute force protection)
  'POST /api/auth/sign-in': { max: 10, timeWindow: '1 minute' },
  'POST /api/auth/sign-up': { max: 5, timeWindow: '1 minute' },
  'POST /api/auth/forgot-password': { max: 3, timeWindow: '1 minute' },

  // Operações de negócio — por plano
  'POST /api/applications/batch': { max: 10, timeWindow: '1 hour' },
  'POST /api/jobs/search': { max: 30, timeWindow: '1 minute' },

  // Reads — mais permissivo
  'GET /api/applications': { max: 60, timeWindow: '1 minute' },
  'GET /api/dashboard/*': { max: 30, timeWindow: '1 minute' },
};
```

---

## 8. Segurança do Browser Automation

### 8.1 Riscos Específicos

O Worker executa Playwright com acesso total ao DOM de sites externos. Isso cria riscos únicos:

| Risco | Descrição | Mitigação |
|-------|-----------|-----------|
| **Page escape** | Site malicioso tenta executar código fora do sandbox | Playwright roda em contexto isolado; `--no-sandbox` nunca usado |
| **Credential exposure** | Credenciais de plataforma expostas em logs/screenshots | Nunca logar credenciais; screenshots salvos sem campos sensíveis |
| **Resource exhaustion** | Site pesado consome toda a RAM do Worker | BrowserPool com timeout por página (60s) + memory limit |
| **Redirect attack** | Vaga redireciona para phishing | Validar URL antes de navegar; whitelist de domínios |

### 8.2 Isolamento do Browser

```typescript
// Browser com capabilities mínimas
const browser = await chromium.launch({
  args: [
    '--disable-gpu',
    '--disable-dev-shm-usage',      // Evita problemas em containers
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--no-first-run',
    '--disable-popup-blocking',
    // NÃO usar --no-sandbox (necessário para segurança)
  ],
});

// Cada candidatura em contexto isolado
const context = await browser.newContext({
  // Sem persistir cookies entre candidaturas
  // Cada candidatura começa com slate limpa
});

try {
  const page = await context.newPage();
  // Timeout agressivo
  page.setDefaultTimeout(30_000);  // 30 segundos
  page.setDefaultNavigationTimeout(15_000);  // 15 segundos

  // Validar domínio antes de navegar
  const url = new URL(jobListing.url);
  if (!ALLOWED_DOMAINS.includes(url.hostname)) {
    throw new Error(`Domain not allowed: ${url.hostname}`);
  }

  await page.goto(jobListing.url);
  // ... preencher formulário
} finally {
  await context.close();  // Sempre limpar
}
```

### 8.3 Domínios Permitidos

```typescript
const ALLOWED_DOMAINS = [
  // Indeed
  'indeed.com', 'www.indeed.com', 'indeed.com.br', 'www.indeed.com.br',
  'secure.indeed.com', 'apply.indeed.com',
  // LinkedIn
  'linkedin.com', 'www.linkedin.com',
  'easy.linkedin.com', 'jobs.linkedin.com',
];
```

---

## 9. Gestão de Secrets

### 9.1 Classificação de Secrets

| Secret | Onde armazenado | Quem acessa | Rotação |
|--------|----------------|-------------|---------|
| `DATABASE_URL` | Railway env vars | API, Worker | Na troca de senha do DB |
| `REDIS_URL` | Railway env vars | API, Worker | Na troca de senha do Redis |
| `BETTER_AUTH_SECRET` | Railway env vars | API | A cada 90 dias |
| `ENCRYPTION_KEY` | Railway env vars | API, Worker | A cada 180 dias (requer re-encrypt) |
| `SENTRY_DSN` | Railway env vars | API, Worker, Frontend | Raramente |
| API keys Anthropic (users) | Postgres (encriptado AES-256-GCM) | Worker (decriptado no uso) | Pelo usuário |

### 9.2 Prevenção de Vazamento

```bash
# 1. .gitignore
.env
.env.local
.env.production
*.pem
*.key

# 2. Pre-commit hook com git-secrets
# Instalar: brew install git-secrets
git secrets --install
git secrets --register-aws    # Bloqueia AWS keys
git secrets --add 'sk-[a-zA-Z0-9]{48}'  # Bloqueia Anthropic API keys
git secrets --add 'BETTER_AUTH_SECRET=[^\s]+'

# 3. Pino redaction (já configurado no doc de infra)
redact: {
  paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.apiKey'],
  censor: '[REDACTED]',
}
```

---

## 10. Segurança do Frontend

### 10.1 Proteções Nativas do React

React escapa HTML por padrão. Regras adicionais:

```typescript
// ❌ NUNCA — abre vetor XSS
<div dangerouslySetInnerHTML={{ __html: jobDescription }} />

// ✅ Se absolutamente necessário (descrições de vagas em HTML)
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(jobDescription) }} />

// ✅ MELHOR — renderizar como texto puro quando possível
<p>{jobDescription}</p>
```

### 10.2 Proteção de Tokens

```typescript
// Tokens NUNCA no localStorage (vulnerável a XSS)
// Better Auth usa cookies httpOnly — inacessíveis via JavaScript

// API key do Anthropic: NUNCA enviada ao frontend
// O frontend envia a key UMA VEZ (no cadastro), o backend encripta e armazena
// Depois disso, o frontend nunca mais vê a key
```

### 10.3 CSP (Content Security Policy)

Configurado via Helmet no backend (seção A02) e via meta tag no frontend:

```html
<!-- index.html do SPA -->
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self';
           script-src 'self';
           style-src 'self' 'unsafe-inline';
           img-src 'self' data: https:;
           connect-src 'self' https://api.autoapply.app;
           font-src 'self';
           frame-src 'none';
           object-src 'none';">
```

---

## 11. Incident Response

### 11.1 Classificação de Incidentes

| Severidade | Descrição | Tempo de resposta | Exemplo |
|-----------|-----------|-------------------|---------|
| **P0 — Critical** | Breach confirmado, dados expostos | 1 hora | Database dump vazado |
| **P1 — High** | Vulnerabilidade ativa sendo explorada | 4 horas | Injection descoberto em produção |
| **P2 — Medium** | Vulnerabilidade identificada, sem exploração | 24 horas | Dependency com CVE critical |
| **P3 — Low** | Issue de segurança menor | 1 semana | Header de segurança faltando |

### 11.2 Runbook de Breach (P0)

```
Minuto 0-15: CONTENÇÃO
├── Identificar o vetor de ataque
├── Bloquear acesso (se possível sem derrubar o serviço)
├── Rotacionar TODOS os secrets comprometidos
└── Invalidar TODAS as sessões de usuário

Minuto 15-60: AVALIAÇÃO
├── Determinar quais dados foram expostos
├── Analisar logs de acesso (Sentry + Railway logs)
├── Identificar período do incidente (desde quando)
└── Documentar findings

Hora 1-24: COMUNICAÇÃO
├── Notificar usuários afetados (email)
├── Notificar ANPD se dados pessoais foram expostos (Art. 48 LGPD)
│   └── "prazo razoável" — na prática, o mais rápido possível
├── Publicar status page com informações transparentes
└── Notificar processadores afetados (Anthropic, se API keys vazaram)

Dia 1-7: REMEDIAÇÃO
├── Corrigir vulnerabilidade
├── Deploy de fix em produção
├── Audit completo em busca de vulnerabilidades similares
├── Atualizar documentação de segurança
└── Post-mortem com action items

Dia 7-30: PREVENÇÃO
├── Implementar controles que teriam prevenido o incidente
├── Adicionar testes de segurança específicos
├── Revisar e atualizar threat model
└── Treinar equipe se necessário
```

### 11.3 Notificação à ANPD (Art. 48 LGPD)

A notificação deve conter no mínimo:
- Descrição da natureza dos dados pessoais afetados
- Informações sobre os titulares envolvidos
- Medidas técnicas e de segurança utilizadas para proteção dos dados
- Riscos relacionados ao incidente
- Motivos da demora (se não foi comunicado imediatamente)
- Medidas que foram ou serão adotadas para reverter ou mitigar o incidente

---

## 12. Testes de Segurança

### 12.1 Testes Automatizados no CI

```yaml
# Adições ao pipeline de CI
security-tests:
  name: Security Tests
  runs-on: ubuntu-latest
  steps:
    # Audit de dependências
    - name: pnpm audit
      run: pnpm audit --audit-level=high

    # Scan de secrets no código
    - name: Scan for secrets
      uses: trufflesecurity/trufflehog@main
      with:
        extra_args: --only-verified

    # Scan de Docker image
    - name: Docker Scout CVE scan
      uses: docker/scout-action@v1
      with:
        command: cves
        image: autoapply-api:latest
        only-severities: critical,high
        exit-code: true

    # SAST (Static Application Security Testing)
    - name: CodeQL Analysis
      uses: github/codeql-action/analyze@v3
      with:
        languages: typescript
```

### 12.2 Testes Manuais (Periódicos)

| Teste | Frequência | Ferramenta |
|-------|-----------|------------|
| Penetration testing | Trimestral (após prod) | OWASP ZAP / Burp Suite |
| Dependency review | Semanal (Renovate PR) | Renovate + pnpm audit |
| Secret scanning | Contínuo (CI) | TruffleHog |
| Access control review | Mensal | Manual (checklist) |
| Backup restore test | Mensal | Script automatizado |

### 12.3 Testes Unitários de Segurança

```typescript
// Exemplos de testes que devem existir

describe('Access Control', () => {
  it('user cannot access another users applications', async () => {
    const res = await api.get(`/applications/${otherUsersAppId}`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(res.status).toBe(404); // 404, não 403 (evita enumeration)
  });

  it('free user cannot batch apply', async () => {
    const res = await api.post('/applications/batch')
      .set('Authorization', `Bearer ${freeUserToken}`)
      .send({ jobIds: ['1', '2', '3'] });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PLAN_REQUIRED');
  });
});

describe('Input Validation', () => {
  it('rejects search query longer than 200 chars', async () => {
    const res = await api.post('/jobs/search')
      .send({ q: 'a'.repeat(201) });
    expect(res.status).toBe(400);
  });

  it('rejects negative salary', async () => {
    const res = await api.post('/jobs/search')
      .send({ q: 'react', salaryMin: -1000 });
    expect(res.status).toBe(400);
  });
});

describe('Encryption', () => {
  it('encrypts and decrypts API key correctly', () => {
    const original = 'sk-ant-api03-test-key-12345';
    const encrypted = encrypt(original);
    expect(encrypted).not.toContain(original); // Não está em plain text
    expect(decrypt(encrypted)).toBe(original);
  });

  it('encrypted value changes on each call (random IV)', () => {
    const key = 'sk-ant-api03-test-key-12345';
    expect(encrypt(key)).not.toBe(encrypt(key)); // IV diferente
  });
});

describe('Rate Limiting', () => {
  it('blocks after 10 login attempts', async () => {
    for (let i = 0; i < 10; i++) {
      await api.post('/auth/sign-in').send({ email: 'test@test.com', password: 'wrong' });
    }
    const res = await api.post('/auth/sign-in').send({ email: 'test@test.com', password: 'wrong' });
    expect(res.status).toBe(429);
  });
});
```

---

## 13. Checklist de Segurança por Fase

### MVP (Pré-launch)

- [ ] HTTPS em todos os endpoints
- [ ] Better Auth configurado com rate limiting
- [ ] Senhas com bcrypt (Better Auth default)
- [ ] Cookies httpOnly + Secure + SameSite
- [ ] Zod validation em todas as rotas
- [ ] Prisma para todas queries (sem SQL raw)
- [ ] CORS restrito ao domínio do frontend
- [ ] Helmet headers configurados
- [ ] API keys encriptadas com AES-256-GCM
- [ ] Error handler não expõe stack traces
- [ ] Pino com redaction de PII
- [ ] `.env` no `.gitignore`
- [ ] pnpm audit no CI
- [ ] TruffleHog no CI
- [ ] Postgres sem acesso externo direto
- [ ] Usuário não-root nos containers
- [ ] Privacy Policy publicada
- [ ] Consentimento explícito para upload de currículo
- [ ] Endpoint de exclusão de conta funcional

### Produção (Pós-launch)

- [ ] Sentry configurado com alertas
- [ ] Audit log para ações sensíveis
- [ ] Rate limiting por plano implementado
- [ ] Backup diário testado (restore funciona)
- [ ] Incident response plan documentado
- [ ] OWASP ZAP scan trimestral
- [ ] CodeQL no CI
- [ ] Docker Scout no CI
- [ ] Branch protection rules no GitHub
- [ ] Rotação de secrets em calendário
- [ ] Monitoring de login failures spike
- [ ] DPO (encarregado) nomeado para LGPD

### Escala (Multi-tenant)

- [ ] Row-level security auditado
- [ ] Penetration test por terceiro
- [ ] SOC 2 Type I (se clientes enterprise)
- [ ] Seguro cyber (se operação significativa)
- [ ] Bug bounty program (opcional)

---

## 14. ADRs (Architecture Decision Records)

| # | Decisão | Contexto | Alternativa rejeitada |
|---|---------|----------|----------------------|
| S-001 | Sessions no banco, não JWT stateless | Revogação imediata, sem blacklist complexa | JWT (não permite invalidação sem server-side state) |
| S-002 | AES-256-GCM para API keys em repouso | Padrão NIST, autenticado (detecta tamper) | AES-CBC (sem autenticação, vulnerável a padding oracle) |
| S-003 | Cookie httpOnly, não localStorage | Imune a XSS para tokens | localStorage (acessível via JavaScript, vulnerável a XSS) |
| S-004 | Zod em toda rota, não validação manual | Type-safe, composable, zero falha humana | Express-validator (string-based, sem inferência de tipos) |
| S-005 | 404 para recurso de outro user, não 403 | Evita enumeration de IDs | 403 (confirma que o recurso existe) |
| S-006 | Audit logs append-only, separado de dados | Sobrevive a exclusão de conta, compliance | Logs no mesmo modelo (deletados com o user) |
| S-007 | LGPD compliance desde o MVP | Brasil é mercado principal, retrofit é caro | "Vemos depois" (dívida técnica de compliance) |
| S-008 | Browser contexts isolados por candidatura | Sem leak de cookies/estado entre candidaturas | Contexto reutilizado (risco de cross-contamination) |
| S-009 | Whitelist de domínios para navegação | Previne redirect para phishing | Navegação irrestrita (risco de SSRF) |
| S-010 | Consentimento explícito para currículo | Currículo pode conter dados sensíveis (LGPD Art. 11) | Consentimento implícito (não compliance com LGPD) |
