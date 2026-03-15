import { randomUUID } from "node:crypto";
import type { BrowserContext } from "playwright";
import { JobListing } from "../../domain/entities/JobListing.js";
import { JobPlatform } from "../../domain/value-objects/JobPlatform.js";
import type { IJobSearcher, JobSearchFilters, JobSearchResult } from "../../application/ports/IJobSearcher.js";
import { StealthPlugin } from "./StealthPlugin.js";

export class IndeedAdapter implements IJobSearcher {
  constructor(private readonly context: BrowserContext) {}

  async search(filters: JobSearchFilters): Promise<JobSearchResult> {
    const page = await this.context.newPage();
    try {
      await StealthPlugin.applyToPage(page);

      const query = encodeURIComponent(filters.query);
      const location = encodeURIComponent(filters.location ?? "");
      const pageIndex = ((filters.page ?? 1) - 1) * 15;
      const url = `https://br.indeed.com/jobs?q=${query}&l=${location}&start=${pageIndex}`;

      await page.goto(url, { timeout: 30_000, waitUntil: "domcontentloaded" });

      // Wait for job cards — single round-trip
      await page
        .waitForSelector(
          '.job_seen_beacon, [data-testid="jobsearch-ResultsList"], #mosaic-provider-jobcards',
          { timeout: 15_000 }
        )
        .catch(() => {});

      // Extract all card data in one page.evaluate() call — avoids 64+ sequential Playwright round-trips
      const raw = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll("div.job_seen_beacon"));
        return cards.map((card) => {
          const jobLink = card.querySelector("a[data-jk]");
          const jobId = jobLink?.getAttribute("data-jk") ?? "";
          const title =
            (card.querySelector(".jobTitle span[title]") as HTMLElement)?.title ||
            card.querySelector(".jobTitle a span")?.textContent?.trim() ||
            "";
          const company =
            card.querySelector('[data-testid="company-name"]')?.textContent?.trim() ?? "Unknown";
          const location =
            card.querySelector('[data-testid="text-location"]')?.textContent?.trim() ?? null;
          const salary =
            card.querySelector(".salary-snippet-container")?.textContent?.trim() ?? null;
          return { jobId, title, company, location, salary };
        });
      });

      const platform = JobPlatform.create("indeed");
      const scrapedAt = new Date();
      const items: JobListing[] = [];

      for (const { jobId, title, company, location, salary } of raw) {
        if (!jobId || !title) continue;
        items.push(
          JobListing.create({
            id: randomUUID(),
            externalId: jobId,
            platform,
            title,
            company,
            location,
            salary,
            description: null,
            url: `https://br.indeed.com/viewjob?jk=${jobId}`,
            postedAt: null,
            scrapedAt,
            metadata: null,
            isActive: true,
          })
        );
      }

      return { items, total: items.length };
    } finally {
      await page.close();
    }
  }
}
