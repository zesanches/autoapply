import type { FastifyInstance } from "fastify";
import fastifyHelmet from "@fastify/helmet";
import { registerRateLimiter } from "../middlewares/rate-limiter.js";

export async function securityPlugin(app: FastifyInstance): Promise<void> {
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // API-only, no HTML
  });
  await registerRateLimiter(app);
}
