import { Queue } from "bullmq";
import type { IQueueService, EnqueueOptions } from "../../application/ports/IQueueService.js";

export class BullMQService implements IQueueService {
  private readonly queues = new Map<string, Queue>();

  constructor(private readonly redisUrl: string) {}

  private getQueue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      const url = new URL(this.redisUrl);
      queue = new Queue(name, {
        connection: {
          host: url.hostname,
          port: parseInt(url.port || "6379"),
        },
      });
      this.queues.set(name, queue);
    }
    return queue;
  }

  async enqueue<T>(
    queueName: string,
    data: T,
    options?: EnqueueOptions
  ): Promise<string> {
    const queue = this.getQueue(queueName);
    const opts: Record<string, unknown> = {};
    if (options?.delay !== undefined) opts["delay"] = options.delay;
    if (options?.priority !== undefined) opts["priority"] = options.priority;
    if (options?.jobId !== undefined) opts["jobId"] = options.jobId;

    const job = await queue.add(queueName, data, opts);
    return job.id ?? "";
  }

  async enqueueMany<T>(
    queueName: string,
    jobs: Array<{ data: T; options?: EnqueueOptions }>
  ): Promise<string[]> {
    const queue = this.getQueue(queueName);
    const added = await queue.addBulk(
      jobs.map(({ data, options }) => {
        const opts: Record<string, unknown> = {};
        if (options?.delay !== undefined) opts["delay"] = options.delay;
        if (options?.priority !== undefined) opts["priority"] = options.priority;
        if (options?.jobId !== undefined) opts["jobId"] = options.jobId;
        return { name: queueName, data, opts };
      })
    );
    return added.map((j) => j.id ?? "");
  }

  async close(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }
}
