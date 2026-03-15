import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Container } from "../../../shared/container/di.js";

const BatchApplyBodySchema = z.object({
  jobIds: z.array(z.string()).min(1).max(50),
});

export function applicationsRoutes(container: Container) {
  return async function (app: FastifyInstance): Promise<void> {
    app.post("/batch", async (req, reply) => {
      if (!req.userId) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const body = BatchApplyBodySchema.parse(req.body);
      const result = await container.useCases.batchApply.execute({
        userId: req.userId,
        jobIds: body.jobIds,
      });

      return reply.status(202).send({ success: true, data: result });
    });

    app.get("/", async (req, reply) => {
      if (!req.userId) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      // TODO: Implement with pagination
      return reply.status(200).send({ success: true, data: [], meta: { page: 1, perPage: 20, total: 0 } });
    });

    app.get("/:id", async (req, reply) => {
      if (!req.userId) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }
      // Return 404 for any resource not found (including wrong userId — security)
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Application not found" },
      });
    });

    app.post("/:id/retry", async (req, reply) => {
      if (!req.userId) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const { id } = req.params as { id: string };
      const result = await container.useCases.retryApplication.execute({
        userId: req.userId,
        applicationId: id,
      });

      return reply.status(200).send({ success: true, data: result });
    });
  };
}
