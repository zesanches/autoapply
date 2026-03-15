import { chromium, type Browser, type BrowserContext } from "playwright";
import { StealthPlugin } from "./StealthPlugin.js";

export interface BrowserPoolOptions {
  maxInstances: number;
}

/**
 * Manages a pool of Playwright browser instances.
 * Each candidatura runs in an isolated browser context (no cookie leaks).
 */
export class BrowserPool {
  private readonly browsers: Browser[] = [];
  private readonly contextToBrowser = new Map<BrowserContext, Browser>();
  private readonly maxInstances: number;

  constructor(options: BrowserPoolOptions) {
    this.maxInstances = options.maxInstances;
  }

  async acquire(): Promise<BrowserContext> {
    const browser = await chromium.launch({ headless: true });
    this.browsers.push(browser);
    const context = await browser.newContext({
      userAgent: StealthPlugin.randomUserAgent(),
      viewport: StealthPlugin.randomViewport(),
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
    });
    this.contextToBrowser.set(context, browser);
    return context;
  }

  async release(context: BrowserContext): Promise<void> {
    await context.close();
    const browser = this.contextToBrowser.get(context);
    this.contextToBrowser.delete(context);
    if (browser) {
      const idx = this.browsers.indexOf(browser);
      if (idx !== -1) this.browsers.splice(idx, 1);
      await browser.close();
    }
  }

  async close(): Promise<void> {
    await Promise.all(this.browsers.map((b) => b.close()));
  }

  get size(): number {
    return this.browsers.length;
  }

  get maxSize(): number {
    return this.maxInstances;
  }
}
