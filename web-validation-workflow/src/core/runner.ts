import type { Browser, BrowserContext } from "playwright";
import { parseProfile, type Profile } from "../contracts/profile.js";
import type { Credentials } from "../contracts/credentials.js";
import { makeResult, type WorkflowResult } from "../contracts/result.js";
import { safeErrorMessage } from "../security/redaction.js";
import { createIsolatedContext } from "../browser/isolation.js";
import { launchEphemeralBrowser } from "../browser/browser-session.js";
import { writeEvidence } from "../evidence/reporter.js";
import { withTimeout, WorkflowTimeoutError } from "./timeout.js";
import { validateLogin } from "./workflow.js";

export interface RunOptions { profile: Profile; credentials: Credentials; artifactRoot: string; }

function runId(): string { return `${new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15)}Z-${crypto.randomUUID().slice(0, 6)}`; }

export async function runValidation(options: RunOptions): Promise<WorkflowResult> {
  const started = Date.now();
  const id = runId();
  let profile: Profile;
  try { profile = parseProfile(options.profile); }
  catch { return writeEvidence(options.artifactRoot, makeResult({ result: "ERROR", profile: "unknown", runId: id, stage: "PROFILE", reason: "PROFILE_INVALID", durationMs: Date.now() - started })); }
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  try {
    const outcome = await withTimeout((async () => {
      browser = await launchEphemeralBrowser(profile);
      context = await createIsolatedContext(browser);
      return validateLogin(context, options.credentials, profile);
    })(), profile.limits.totalTimeoutMs);
    return writeEvidence(options.artifactRoot, makeResult({ ...outcome, profile: profile.id, runId: id, durationMs: Date.now() - started }));
  } catch (error) {
    const reason = error instanceof WorkflowTimeoutError ? "NAVIGATION_TIMEOUT" : "WORKFLOW_ERROR";
    // Intentionally do not emit caught errors: provider errors can contain runtime secrets.
    safeErrorMessage(error, [options.credentials.password]);
    return writeEvidence(options.artifactRoot, makeResult({ result: "ERROR", profile: profile.id, runId: id, stage: "WORKFLOW", reason, durationMs: Date.now() - started }));
  } finally {
    await context?.close();
    await browser?.close();
  }
}
