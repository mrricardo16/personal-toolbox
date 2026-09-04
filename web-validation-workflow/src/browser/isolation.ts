import type { Browser, BrowserContext } from "playwright";

/** Creates an ephemeral context; callers must close it after exactly one validation. */
export function createIsolatedContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ serviceWorkers: "block" });
}
