import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../../shared/config/env.js";
import type { Container } from "../../../shared/container/di.js";

const CreateProfileBodySchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().max(20).optional(),
  location: z.string().max(100).optional(),
  linkedinUrl: z.string().url().optional(),
  skills: z.array(z.string()).default([]),
});

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

export function profileRoutes(container: Container) {
  return async function (app: FastifyInstance): Promise<void> {
    app.get("/", async (req, reply) => {
      if (!req.userId) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const profile = await container.profileRepository.findByUserId(req.userId);
      if (!profile) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Profile not found" },
        });
      }

      return reply.status(200).send({ success: true, data: profile.toJSON() });
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

    // POST /api/profile/resume — multipart upload
    app.post("/resume", async (req, reply) => {
      if (!req.userId) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      const data = await req.file();
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: { code: "BAD_REQUEST", message: "No file uploaded" },
        });
      }

      const mimeType = data.mimetype;
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        return reply.status(422).send({
          success: false,
          error: {
            code: "UNSUPPORTED_FILE_TYPE",
            message: "Only PDF, DOCX, DOC, and TXT files are accepted",
          },
        });
      }

      const fileBuffer = await data.toBuffer();

      const result = await container.useCases.uploadResume.execute({
        userId: req.userId,
        fileBuffer,
        mimeType,
        originalFilename: data.filename ?? "resume",
        uploadDir: env.UPLOAD_DIR,
      });

      return reply.status(200).send({ success: true, data: result });
    });
  };
}
