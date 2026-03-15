import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Container } from "../../../shared/container/di.js";

const CreateProfileBodySchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().max(20).optional(),
  location: z.string().max(100).optional(),
  linkedinUrl: z.string().url().optional(),
  skills: z.array(z.string()).default([]),
});

export function profileRoutes(container: Container) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get("/", async (req, reply) => {
      if (!req.userId) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }
      // TODO: Implement
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Profile not found" },
      });
    });

    app.post("/", async (req, reply) => {
      if (!req.userId) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const body = CreateProfileBodySchema.parse(req.body);
      const result = await container.useCases.createUserProfile.execute({
        userId: req.userId,
        ...body,
      });

      return reply.status(201).send({ success: true, data: result });
    });
  };
}
