import type { FastifyInstance } from "fastify";
import type { Container } from "../../../shared/container/di.js";

export function dashboardRoutes(container: Container) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get("/stats", async (req, reply) => {
      if (!req.userId) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const result = await container.useCases.getDashboardStats.execute({
        userId: req.userId,
      });

      return reply.status(200).send({ success: true, data: result });
    });
  };
}
