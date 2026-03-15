import { randomUUID } from "node:crypto";
import type { BrowserContext } from "playwright";
import { JobListing } from "../../domain/entities/JobListing.js";
import { JobPlatform } from "../../domain/value-objects/JobPlatform.js";
import type { IJobSearcher, JobSearchFilters, JobSearchResult } from "../../application/ports/IJobSearcher.js";
import type { IFormAnalyzer } from "../../application/ports/IFormAnalyzer.js";
import { StealthPlugin } from "./StealthPlugin.js";

export interface ApplyResult {
  success: boolean;
  formData?: Record<string, string>;
  error?: string;
}

function humanDelay(minMs = 300, maxMs = 800): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, minMs + Math.floor(Math.random() * (maxMs - minMs)))
  );
}

export class IndeedAdapter implements IJobSearcher {
  constructor(
    private readonly context: BrowserContext,
    private readonly formAnalyzer?: IFormAnalyzer
  ) {}

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

  async apply(
    job: { url: string },
    profile: { resumeUrl?: string | null; resumeData?: Record<string, unknown> | null }
  ): Promise<ApplyResult> {
    if (!this.formAnalyzer) {
      return { success: false, error: "no_form_analyzer" };
    }

    const page = await this.context.newPage();
    try {
      await StealthPlugin.applyToPage(page);

      // Navigate to job page
      await page.goto(job.url, { timeout: 30_000, waitUntil: "domcontentloaded" });

      // Look for Easy Apply button
      const easyApplySelector =
        '[data-testid="indeedApply"], [class*="ia-IndeedApply"], [class*="IndeedApplyButton"], button[aria-label*="Apply"], button[aria-label*="Aplicar"]';

      const applyButton = await page.$(easyApplySelector);
      if (!applyButton) {
        return { success: false, error: "no_easy_apply" };
      }

      await humanDelay();
      await applyButton.click();

      // Wait for modal/iframe to appear
      await page
        .waitForSelector('iframe[title*="apply"], [data-testid="ia-iframe"], form.ia-Questions', {
          timeout: 10_000,
        })
        .catch(() => {});

      await humanDelay(500, 1000);

      // Extract form HTML — try iframe first, then main page
      let formHtml = "";
      const iframeEl = await page.$('iframe[title*="apply"], [data-testid="ia-iframe"]');
      if (iframeEl) {
        const iframe = await iframeEl.contentFrame();
        if (iframe) {
          await iframe.waitForSelector("form", { timeout: 8_000 }).catch(() => {});
          formHtml = await iframe.evaluate(() => document.querySelector("form")?.outerHTML ?? document.body.innerHTML);
        }
      }
      if (!formHtml) {
        formHtml = await page.evaluate(() => document.querySelector("form")?.outerHTML ?? "");
      }

      if (!formHtml) {
        return { success: false, error: "no_form_found" };
      }

      // Analyze form with Claude
      const analysis = await this.formAnalyzer.analyzeForm(formHtml);
      const fieldValues = profile.resumeData
        ? await this.formAnalyzer.mapProfileToForm(analysis, profile.resumeData as Record<string, unknown>)
        : {};

      // Determine target frame
      const targetFrame = iframeEl ? (await iframeEl.contentFrame()) ?? page : page;

      // Fill each field
      for (const field of analysis.fields) {
        const value = fieldValues[field.name];
        await humanDelay(200, 500);

        try {
          if (field.type === "file" && profile.resumeUrl) {
            // Only upload file if the field asks for it and we have a local path
            const localPath = profile.resumeUrl.startsWith("/uploads/")
              ? `./uploads/${profile.resumeUrl.replace("/uploads/", "")}`
              : null;
            if (localPath) {
              await targetFrame.setInputFiles(`[name="${field.name}"]`, localPath);
            }
          } else if (value) {
            if (field.type === "select") {
              await targetFrame.selectOption(`[name="${field.name}"]`, { label: value }).catch(async () => {
                await targetFrame.selectOption(`[name="${field.name}"]`, { value }).catch(() => {});
              });
            } else if (field.type === "checkbox") {
              // Ignore checkbox mapping for safety
            } else {
              const el = await targetFrame.$(`[name="${field.name}"]`);
              if (el) {
                await el.fill(value);
              }
            }
          }
        } catch {
          // Individual field errors are non-fatal
        }
      }

      await humanDelay(500, 1000);

      // Click submit
      try {
        await targetFrame.click(analysis.submitSelector, { timeout: 5_000 });
      } catch {
        await targetFrame.click("button[type=submit]", { timeout: 5_000 }).catch(() => {});
      }

      // Wait for confirmation
      await humanDelay(2000, 3000);
      const confirmed = await page
        .waitForSelector('[data-testid="postApplyDismiss"], [data-testid="application-confirmation"]', {
          timeout: 5_000,
        })
        .then(() => true)
        .catch(() => page.url().includes("thankyou") || page.url().includes("applied"));

      return { success: !!confirmed, formData: fieldValues };
    } finally {
      await page.close();
    }
  }
}
