import type { Application } from "../../domain/entities/Application.js";

export interface FindApplicationsOptions {
  userId: string;
  status?: string;
  batchId?: string;
  page?: number;
  perPage?: number;
}

export interface IApplicationRepository {
  findById(id: string): Promise<Application | null>;
  findByUserAndJob(userId: string, jobId: string): Promise<Application | null>;
  findMany(options: FindApplicationsOptions): Promise<{
    items: Application[];
    total: number;
  }>;
  save(application: Application): Promise<void>;
  update(application: Application): Promise<void>;
}
