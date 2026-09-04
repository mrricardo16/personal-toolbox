import type { BrowserContext } from "playwright";
import type { Credentials } from "../contracts/credentials.js";
import type { Profile } from "../contracts/profile.js";
import type { AdapterOutcome } from "../adapters/adapter.js";
import { MicrosoftAdapter } from "../adapters/microsoft/microsoft-adapter.js";

/** The workflow decides what is verified; the adapter decides site-specific interactions. */
export async function validateLogin(context: BrowserContext, credentials: Credentials, profile: Profile): Promise<AdapterOutcome> {
  const page = await context.newPage();
  return new MicrosoftAdapter(page).validate(credentials, profile);
}
