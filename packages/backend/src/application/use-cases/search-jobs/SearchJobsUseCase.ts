import type { IJobSearcher } from "../../ports/IJobSearcher.js";
import type { SearchJobsInput, SearchJobsOutput } from "./SearchJobsDTO.js";

export class SearchJobsUseCase {
  constructor(private readonly jobSearcher: IJobSearcher) {}

  async execute(input: SearchJobsInput): Promise<SearchJobsOutput> {
    const page = input.page ?? 1;
    const perPage = input.perPage ?? 20;

    const result = await this.jobSearcher.search({
      query: input.query,
      platform: input.platform,
      location: input.location,
      remote: input.remote,
      salaryMin: input.salaryMin,
      page,
      perPage,
    });

    return {
      items: result.items.map((job) => ({
        id: job.id,
        externalId: job.externalId,
        platform: job.platform.value,
        title: job.title,
        company: job.company,
        location: job.location ?? null,
        salary: job.salary ?? null,
        url: job.url,
        postedAt: job.postedAt ?? null,
      })),
      total: result.total,
      page,
      perPage,
    };
  }
}
