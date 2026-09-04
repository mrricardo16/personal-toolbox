import { chromium, type Browser } from "playwright";
import type { Profile } from "../contracts/profile.js";

export async function launchEphemeralBrowser(profile: Profile): Promise<Browser> {
  if (profile.browser.channel === "msedge") {
    try { return await chromium.launch({ channel: "msedge", headless: profile.browser.headless }); }
    catch (error) {
      if (!(error instanceof Error)) throw error;
      // Edge is preferred but Chromium is a controlled fallback when Edge is unavailable.
      return chromium.launch({ headless: profile.browser.headless });
    }
  }
  return chromium.launch({ headless: profile.browser.headless });
}
