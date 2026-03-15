import type { FastifyInstance } from "fastify";
import type { Container } from "../../../shared/container/di.js";

export function creditsRoutes(_container: Container) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get("/", async (req, reply) => {
      if (!req.userId) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }
      // TODO: Implement
      return reply.status(200).send({ success: true, data: { available: 0, reserved: 0, totalUsed: 0, plan: "FREE" } });
    });

    app.get("/transactions", async (req, reply) => {
      if (!req.userId) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }
      // TODO: Implement
      return reply.status(200).send({ success: true, data: [], meta: { page: 1, perPage: 20, total: 0 } });
    });
  };
}
