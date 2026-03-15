import type { FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import { env } from "../../../shared/config/env.js";

export async function corsPlugin(app: FastifyInstance): Promise<void> {
  await app.register(fastifyCors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
}
