import type { Page } from "playwright";

/**
 * Applies anti-detection measures to a Playwright page.
 * Randomizes user-agent, viewport, and other browser fingerprints.
 */
export class StealthPlugin {
  private static readonly USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  ];

  private static readonly VIEWPORTS = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
  ];

  static randomUserAgent(): string {
    const agents = StealthPlugin.USER_AGENTS;
    return agents[Math.floor(Math.random() * agents.length)] ?? agents[0]!;
  }

  static randomViewport(): { width: number; height: number } {
    const viewports = StealthPlugin.VIEWPORTS;
    return viewports[Math.floor(Math.random() * viewports.length)] ?? viewports[0]!;
  }

  static humanDelay(minMs = 100, maxMs = 500): number {
    return Math.floor(Math.random() * (maxMs - minMs) + minMs);
  }

  static async applyToPage(page: Page): Promise<void> {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, "languages", {
        get: () => ["pt-BR", "pt", "en"],
      });
      // @ts-ignore
      window.chrome = { runtime: {} };
    });
  }
}
