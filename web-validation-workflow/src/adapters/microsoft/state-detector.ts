import type { Page } from "playwright";
import { microsoftSelectors } from "./selectors.js";

export type MicrosoftState = "USERNAME" | "PASSWORD" | "AUTH_SUCCESS" | "ACCOUNT_NOT_FOUND" | "INVALID_CREDENTIALS" | "MFA_REQUIRED" | "CAPTCHA_REQUIRED" | "ACCOUNT_LOCKED" | "FEDERATED_IDP_REQUIRED" | "POLICY_BLOCKED" | "MAILBOX_READY" | "MAILBOX_UNAVAILABLE" | "UNKNOWN_AUTH_STATE";

export async function detectMicrosoftState(page: Page): Promise<MicrosoftState> {
  const fixture = await page.locator("#app").getAttribute("data-fixture-state").catch(() => null);
  if (fixture && fixture !== "UNRECOGNIZED") return fixture as MicrosoftState;
  const text = await page.locator("body").innerText().catch(() => "");
  if (microsoftSelectors.accountNotFound.test(text)) return "ACCOUNT_NOT_FOUND";
  if (microsoftSelectors.invalidCredentials.test(text)) return "INVALID_CREDENTIALS";
  if (microsoftSelectors.mfa.test(text)) return "MFA_REQUIRED";
  if (microsoftSelectors.captcha.test(text)) return "CAPTCHA_REQUIRED";
  if (microsoftSelectors.locked.test(text)) return "ACCOUNT_LOCKED";
  if (microsoftSelectors.federated.test(text)) return "FEDERATED_IDP_REQUIRED";
  if (microsoftSelectors.policy.test(text)) return "POLICY_BLOCKED";
  if (microsoftSelectors.mailboxUnavailable.test(text)) return "MAILBOX_UNAVAILABLE";
  if (await page.locator(microsoftSelectors.username.join(",")).count()) return "USERNAME";
  if (await page.locator(microsoftSelectors.password.join(",")).count()) return "PASSWORD";
  const host = new URL(page.url()).hostname;
  const mailboxSignals = [host.endsWith("outlook.live.com") || host.endsWith("outlook.office.com"), /outlook|outlook on the web/i.test(text), /inbox|收件箱|mail navigation|邮件导航/i.test(text)].filter(Boolean).length;
  if (mailboxSignals >= 3) return "MAILBOX_READY";
  return "UNKNOWN_AUTH_STATE";
}
