import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Container } from "../../../shared/container/di.js";

const SearchQuerySchema = z.object({
  q: z.string().min(1),
  platform: z.enum(["indeed", "linkedin"]),
  location: z.string().optional(),
  remote: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});

export function jobsRoutes(container: Container) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get("/search", async (req, reply) => {
      if (!req.userId) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const query = SearchQuerySchema.parse(req.query);
      const result = await container.useCases.searchJobs.execute({
        userId: req.userId,
        query: query.q,
        platform: query.platform,
        location: query.location,
        remote: query.remote,
        page: query.page,
        perPage: query.perPage,
      });

      return reply.status(200).send({
        success: true,
        data: result.items,
        meta: { page: result.page, perPage: result.perPage, total: result.total },
      });
    });

    app.get("/:id", async (req, reply) => {
      // TODO: Implement
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Job not found" },
      });
    });
  };
}
