import type { IJobSearcher, JobSearchFilters, JobSearchResult } from "../../application/ports/IJobSearcher.js";
import { BrowserPool } from "./BrowserPool.js";
import { IndeedAdapter } from "./IndeedAdapter.js";

export class BrowserJobSearcher implements IJobSearcher {
  constructor(private readonly pool: BrowserPool) {}

  async search(filters: JobSearchFilters): Promise<JobSearchResult> {
    const context = await this.pool.acquire();
    try {
      const adapter = new IndeedAdapter(context);
      return await adapter.search(filters);
    } finally {
      await this.pool.release(context);
    }
  }
}
