import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import { fromNodeHeaders } from "better-auth/node";
import { env } from "../../shared/config/env.js";
import { logger } from "../../shared/logger/index.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { securityPlugin } from "./plugins/security.plugin.js";
import { applicationsRoutes } from "./routes/applications.routes.js";
import { jobsRoutes } from "./routes/jobs.routes.js";
import { profileRoutes } from "./routes/profile.routes.js";
import { dashboardRoutes } from "./routes/dashboard.routes.js";
import { creditsRoutes } from "./routes/credits.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { createAuth } from "../auth/better-auth.js";
import type { Container } from "../../shared/container/di.js";

export async function createServer(container: Container) {
  const app = Fastify({
    logger: false, // Using pino directly
    trustProxy: env.NODE_ENV === "production",
    bodyLimit: 10 * 1024 * 1024, // 10MB for resume uploads
    requestTimeout: 60_000, // Browser automation (job search) can take up to ~15s
  });

  const auth = createAuth(container.prisma);

  // Plugins
  await app.register(fastifyCors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(securityPlugin);
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 1,
    },
  });

  // Auth session extraction — must be on root app to apply globally
  app.decorateRequest("userId", undefined);
  app.addHook("preHandler", async (req) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (session?.user) {
      req.userId = session.user.id;
    }
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Health check
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  }));

  // Routes
  await app.register(authRoutes(auth), { prefix: "/api/auth" });
  await app.register(applicationsRoutes(container), { prefix: "/api/applications" });
  await app.register(jobsRoutes(container), { prefix: "/api/jobs" });
  await app.register(profileRoutes(container), { prefix: "/api/profile" });
  await app.register(dashboardRoutes(container), { prefix: "/api/dashboard" });
  await app.register(creditsRoutes(container), { prefix: "/api/credits" });

  return app;
}

export async function startServer(container: Container): Promise<void> {
  const app = await createServer(container);

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    logger.info({ port: env.PORT }, "HTTP server started");
  } catch (err) {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  }
}
