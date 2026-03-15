import type { PrismaClient, ApplicationStatus as PrismaStatus } from "@prisma/client";
import type {
  IApplicationRepository,
  FindApplicationsOptions,
} from "../../../application/ports/IApplicationRepository.js";
import { Application } from "../../../domain/entities/Application.js";
import { ApplicationStatus } from "../../../domain/value-objects/ApplicationStatus.js";
import type { ApplicationStatusValue } from "../../../domain/value-objects/ApplicationStatus.js";

function toPrismaStatus(status: string): PrismaStatus {
  return status.toUpperCase() as PrismaStatus;
}

function toDomainStatus(status: PrismaStatus): ApplicationStatus {
  return ApplicationStatus.create(status.toLowerCase() as ApplicationStatusValue);
}

function toDomain(row: {
  id: string;
  userId: string;
  jobId: string;
  batchId: string | null;
  status: PrismaStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  submittedAt: Date | null;
  formData: unknown;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): Application {
  return Application.create({
    id: row.id,
    userId: row.userId,
    jobId: row.jobId,
    batchId: row.batchId,
    status: toDomainStatus(row.status),
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    lastError: row.lastError,
    submittedAt: row.submittedAt,
    formData: row.formData,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class PrismaApplicationRepository implements IApplicationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Application | null> {
    const row = await this.prisma.application.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByUserAndJob(userId: string, jobId: string): Promise<Application | null> {
    const row = await this.prisma.application.findUnique({
      where: { userId_jobId: { userId, jobId } },
    });
    return row ? toDomain(row) : null;
  }

  async findMany(
    options: FindApplicationsOptions
  ): Promise<{ items: Application[]; total: number }> {
    const { userId, status, batchId, page = 1, perPage = 20 } = options;

    const where = {
      userId,
      ...(status ? { status: toPrismaStatus(status) } : {}),
      ...(batchId ? { batchId } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.application.count({ where }),
    ]);

    return { items: rows.map(toDomain), total };
  }

  async save(application: Application): Promise<void> {
    await this.prisma.application.create({
      data: {
        id: application.id,
        userId: application.userId,
        jobId: application.jobId,
        batchId: application.batchId,
        status: toPrismaStatus(application.status.value),
        attempts: application.attempts,
        maxAttempts: application.maxAttempts,
        lastError: application.lastError,
        submittedAt: application.submittedAt,
      },
    });
  }

  async update(application: Application): Promise<void> {
    await this.prisma.application.update({
      where: { id: application.id },
      data: {
        status: toPrismaStatus(application.status.value),
        attempts: application.attempts,
        lastError: application.lastError,
        submittedAt: application.submittedAt,
      },
    });
  }
}
