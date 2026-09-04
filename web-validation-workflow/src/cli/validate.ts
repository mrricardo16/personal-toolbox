import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { readCredentials } from "../contracts/credentials.js";
import { parseProfile, type Profile } from "../contracts/profile.js";
import { exitCodeFor, makeResult } from "../contracts/result.js";
import { writeEvidence } from "../evidence/reporter.js";
import { runValidation } from "../core/runner.js";

export function parseCliArguments(arguments_: readonly string[]): { profile: "outlook" } {
  if (arguments_.length !== 2 || arguments_[0] !== "--profile" || arguments_[1] !== "outlook") throw new Error("CLI_ARGUMENT_INVALID");
  return { profile: "outlook" };
}

async function emitCliResult(artifactRoot: string, result: Awaited<ReturnType<typeof makeResult>>): Promise<void> {
  const written = await writeEvidence(artifactRoot, result);
  console.log(JSON.stringify({ runId: written.runId, result: written.result, reason: written.reason }));
  process.exitCode = exitCodeFor(written.result);
}

async function main(): Promise<void> {
  const { profile: profileId } = parseCliArguments(process.argv.slice(2));
  const root = process.cwd();
  const artifactRoot = join(root, "artifacts");
  let profile: Profile;
  try {
    profile = parseProfile(JSON.parse(await readFile(join(root, "profiles", `${profileId}.json`), "utf8")) as unknown);
  } catch {
    await emitCliResult(artifactRoot, makeResult({ result: "ERROR", profile: profileId, runId: `${new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15)}Z-cli`, stage: "PROFILE", reason: "PROFILE_INVALID" }));
    return;
  }

  try {
    const result = await runValidation({ profile, credentials: readCredentials(process.env), artifactRoot });
    await emitCliResult(artifactRoot, result);
  } catch (error) {
    const reason = error instanceof Error && error.message === "CREDENTIALS_MISSING" ? "CREDENTIALS_MISSING" : "WORKFLOW_ERROR";
    await emitCliResult(artifactRoot, makeResult({ result: "ERROR", profile: profileId, runId: `${new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15)}Z-cli`, stage: "WORKFLOW", reason }));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { process.exitCode = 30; });
}
