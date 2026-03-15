export interface EnqueueOptions {
  delay?: number | undefined;
  priority?: number | undefined;
  jobId?: string | undefined;
}

export interface IQueueService {
  enqueue<T>(queue: string, data: T, options?: EnqueueOptions): Promise<string>;
  enqueueMany<T>(queue: string, jobs: Array<{ data: T; options?: EnqueueOptions }>): Promise<string[]>;
}
