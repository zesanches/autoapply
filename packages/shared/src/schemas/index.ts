import { z } from "zod";

export const PlatformSchema = z.enum(["indeed", "linkedin"]);

export const ApplicationStatusSchema = z.enum([
  "queued",
  "applying",
  "submitted",
  "failed",
  "retrying",
  "exhausted",
]);

export const PlanSchema = z.enum(["FREE", "PRO", "ENTERPRISE"]);

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});

export const SearchJobsRequestSchema = z.object({
  query: z.string().min(1).max(200),
  platform: PlatformSchema,
  location: z.string().max(100).optional(),
  remote: z.boolean().optional(),
  salaryMin: z.number().int().positive().optional(),
  ...PaginationSchema.shape,
});

export const BatchApplyRequestSchema = z.object({
  jobIds: z.array(z.string().cuid()).min(1).max(50),
});

export const CreateProfileRequestSchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().max(20).optional(),
  location: z.string().max(100).optional(),
  linkedinUrl: z.string().url().optional(),
  portfolioUrl: z.string().url().optional(),
  skills: z.array(z.string().min(1).max(50)).max(100).default([]),
});

export type SearchJobsRequest = z.infer<typeof SearchJobsRequestSchema>;
export type BatchApplyRequest = z.infer<typeof BatchApplyRequestSchema>;
export type CreateProfileRequest = z.infer<typeof CreateProfileRequestSchema>;
