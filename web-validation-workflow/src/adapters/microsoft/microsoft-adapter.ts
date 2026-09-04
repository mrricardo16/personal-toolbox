import type { Page } from "playwright";
import type { SiteAdapter, AdapterOutcome } from "../adapter.js";
import type { Credentials } from "../../contracts/credentials.js";
import type { Profile } from "../../contracts/profile.js";
import type { Reason } from "../../contracts/result.js";
import { microsoftSelectors } from "./selectors.js";
import { detectMicrosoftState, type MicrosoftState } from "./state-detector.js";

const blocked = new Set<MicrosoftState>(["MFA_REQUIRED", "CAPTCHA_REQUIRED", "ACCOUNT_LOCKED", "FEDERATED_IDP_REQUIRED", "POLICY_BLOCKED"]);
const invalid = new Set<MicrosoftState>(["ACCOUNT_NOT_FOUND", "INVALID_CREDENTIALS", "MAILBOX_UNAVAILABLE"]);

export class MicrosoftAdapter implements SiteAdapter {
  public constructor(private readonly page: Page) {}

  public async validate(credentials: Credentials, profile: Profile): Promise<AdapterOutcome> {
    await this.page.goto(profile.targets.login, { waitUntil: "domcontentloaded", timeout: profile.limits.navigationTimeoutMs });
    let state = await detectMicrosoftState(this.page);
    if (state === "USERNAME") {
      await this.fillAndSubmit(microsoftSelectors.username, credentials.username);
      state = await this.waitForTransition(state, profile.limits.authTimeoutMs);
    }
    if (state === "PASSWORD") {
      await this.fillAndSubmit(microsoftSelectors.password, credentials.password);
      state = await this.waitForTransition(state, profile.limits.authTimeoutMs);
    }
    if (state !== "AUTH_SUCCESS") return this.outcomeFor(state);

    const mailboxTargets = [...new Set([profile.targets.personalMailbox, profile.targets.organizationMailbox])];
    for (const target of mailboxTargets) {
      await this.page.goto(target, { waitUntil: "domcontentloaded", timeout: profile.limits.navigationTimeoutMs });
      state = await detectMicrosoftState(this.page);
      if (state === "MAILBOX_READY") return this.outcomeFor(state, "MAILBOX");
      if (state === "MAILBOX_UNAVAILABLE") continue;
      return this.outcomeFor(state, "MAILBOX");
    }
    return this.outcomeFor("MAILBOX_UNAVAILABLE", "MAILBOX");
  }

  private async fillAndSubmit(selectors: readonly string[], value: string): Promise<void> {
    const field = this.page.locator(selectors.join(",")).first();
    await field.fill(value);
    const button = this.page.getByRole("button", { name: /next|下一步|sign in|登录/i }).or(this.page.locator(microsoftSelectors.submit.join(",")).first());
    await button.click();
  }

  private async waitForTransition(previous: MicrosoftState, timeout: number): Promise<MicrosoftState> {
    await this.page.waitForFunction((prior) => {
      const root = document.querySelector("#app");
      const fixtureState = root?.getAttribute("data-fixture-state");
      if (fixtureState !== null && fixtureState !== prior) return true;
      const body = document.body?.innerText ?? "";
      const hasPassword = Boolean(document.querySelector("input[type='password'], input[autocomplete='current-password'], #i0118"));
      const hasUsername = Boolean(document.querySelector("input[autocomplete='username'], input[name='loginfmt'], #i0116, input[type='email']"));
      return prior === "USERNAME"
        ? hasPassword || !hasUsername || /account|密码|验证码|captcha|authenticator|organization/i.test(body)
        : !hasPassword && /outlook|inbox|收件箱|mail/i.test(body);
    }, previous, { timeout }).catch(() => undefined);
    return detectMicrosoftState(this.page);
  }

  private outcomeFor(state: MicrosoftState, stage: "AUTH" | "MAILBOX" = "AUTH"): AdapterOutcome {
    if (state === "MAILBOX_READY") return { result: "VALID", stage: "MAILBOX", authentication: "SUCCESS", service: "ACCESSIBLE", reason: "MAILBOX_READY" };
    if (invalid.has(state)) return { result: "INVALID", stage: state === "MAILBOX_UNAVAILABLE" ? "MAILBOX" : "AUTH", authentication: state === "MAILBOX_UNAVAILABLE" ? "SUCCESS" : "FAILED", service: state === "MAILBOX_UNAVAILABLE" ? "UNAVAILABLE" : "NOT_CHECKED", reason: state as Reason };
    if (blocked.has(state)) return { result: "BLOCKED", stage, authentication: stage === "AUTH" ? "BLOCKED" : "SUCCESS", service: stage === "AUTH" ? "NOT_CHECKED" : "UNAVAILABLE", reason: state as Reason };
    return { result: "ERROR", stage, authentication: "UNKNOWN", service: "UNKNOWN", reason: "UNKNOWN_AUTH_STATE" };
  }
}
