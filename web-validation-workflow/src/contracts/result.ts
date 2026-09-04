export const RESULTS = ["VALID", "INVALID", "BLOCKED", "ERROR"] as const;
export type ValidationResult = typeof RESULTS[number];
export type Stage = "PROFILE" | "AUTH" | "MAILBOX" | "WORKFLOW";
export type Authentication = "SUCCESS" | "FAILED" | "BLOCKED" | "UNKNOWN";
export type Service = "ACCESSIBLE" | "UNAVAILABLE" | "NOT_CHECKED" | "UNKNOWN";
export type Reason = "MAILBOX_READY" | "ACCOUNT_NOT_FOUND" | "INVALID_CREDENTIALS" | "MAILBOX_UNAVAILABLE" | "MFA_REQUIRED" | "CAPTCHA_REQUIRED" | "ACCOUNT_LOCKED" | "POLICY_BLOCKED" | "FEDERATED_IDP_REQUIRED" | "AUTH_INTERACTION_REQUIRED" | "NAVIGATION_TIMEOUT" | "UNKNOWN_AUTH_STATE" | "WORKFLOW_ERROR" | "PROFILE_INVALID" | "CREDENTIALS_MISSING";
export interface WorkflowResult { schemaVersion: 1; runId: string; workflow: "validate-login"; profile: string; result: ValidationResult; stage: Stage; authentication: Authentication; service: Service; reason: Reason; durationMs: number; evidence: { report: string | null; screenshot: null; trace: null }; }

const defaults: Record<ValidationResult, Pick<WorkflowResult, "stage" | "authentication" | "service" | "reason">> = {
  VALID: { stage: "MAILBOX", authentication: "SUCCESS", service: "ACCESSIBLE", reason: "MAILBOX_READY" },
  INVALID: { stage: "AUTH", authentication: "FAILED", service: "NOT_CHECKED", reason: "INVALID_CREDENTIALS" },
  BLOCKED: { stage: "AUTH", authentication: "BLOCKED", service: "NOT_CHECKED", reason: "AUTH_INTERACTION_REQUIRED" },
  ERROR: { stage: "WORKFLOW", authentication: "UNKNOWN", service: "UNKNOWN", reason: "WORKFLOW_ERROR" }
};

export function makeResult(input: Pick<WorkflowResult, "result" | "profile" | "runId"> & Partial<Omit<WorkflowResult, "schemaVersion" | "workflow" | "result" | "profile" | "runId" | "evidence">>): WorkflowResult {
  const base = defaults[input.result];
  return { schemaVersion: 1, workflow: "validate-login", ...base, ...input, durationMs: input.durationMs ?? 0, evidence: { report: null, screenshot: null, trace: null } };
}

export function exitCodeFor(result: ValidationResult): number {
  return ({ VALID: 0, INVALID: 10, BLOCKED: 20, ERROR: 30 })[result];
}
