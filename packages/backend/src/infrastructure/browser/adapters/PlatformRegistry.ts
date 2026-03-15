import type { BrowserContext } from "playwright";
import type { IJobSearcher } from "../../../application/ports/IJobSearcher.js";
import type { IJobApplier } from "../../../application/ports/IJobApplier.js";
import { IndeedAdapter } from "./IndeedAdapter.js";
import { LinkedInAdapter } from "./LinkedInAdapter.js";
import { PlatformUnavailableError } from "../../../domain/errors/PlatformUnavailableError.js";

type PlatformAdapter = IJobSearcher & IJobApplier;

type AdapterConstructor = new (context: BrowserContext) => PlatformAdapter;

const PLATFORM_ADAPTERS: Record<string, AdapterConstructor> = {
  indeed: IndeedAdapter,
  linkedin: LinkedInAdapter,
};

export class PlatformRegistry {
  resolve(platform: string, context: BrowserContext): PlatformAdapter {
    const AdapterClass = PLATFORM_ADAPTERS[platform.toLowerCase()];
    if (!AdapterClass) {
      throw new PlatformUnavailableError(platform);
    }
    return new AdapterClass(context);
  }

  supported(): string[] {
    return Object.keys(PLATFORM_ADAPTERS);
  }
}
