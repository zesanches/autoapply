import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  ANTHROPIC_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  MAX_BROWSER_INSTANCES: z.coerce.number().int().positive().default(3),
  UPLOAD_DIR: z.string().default("./uploads"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const missing = Object.keys(errors).join(", ");
    throw new Error(`Invalid environment variables: ${missing}\n${result.error.message}`);
  }
  return result.data;
}

export const env = parseEnv();
