import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WorkflowResult } from "../contracts/result.js";

export async function writeEvidence(artifactRoot: string, result: WorkflowResult): Promise<WorkflowResult> {
  const directory = join(artifactRoot, result.runId);
  await mkdir(join(directory, "screenshots"), { recursive: true });
  await mkdir(join(directory, "traces"), { recursive: true });
  const relativeReport = `artifacts/${result.runId}/report.md`;
  const safe = { ...result, evidence: { report: relativeReport, screenshot: null, trace: null } };
  const report = `# Web Validation Report\n\n- Run ID: ${safe.runId}\n- Profile: ${safe.profile}\n- Result: ${safe.result}\n- Stage: ${safe.stage}\n- Authentication: ${safe.authentication}\n- Service: ${safe.service}\n- Reason: ${safe.reason}\n- Duration: ${safe.durationMs} ms\n\nAuthentication traces and screenshots are not recorded during this MVP.\n`;
  await writeFile(join(directory, "result.json"), `${JSON.stringify(safe, null, 2)}\n`, "utf8");
  await writeFile(join(directory, "report.md"), report, "utf8");
  return safe;
}
