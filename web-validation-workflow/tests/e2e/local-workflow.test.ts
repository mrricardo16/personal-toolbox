import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runValidation } from "../../src/core/runner.js";
import type { Profile } from "../../src/contracts/profile.js";

const fixture = await readFile("fixtures/microsoft/index.html");
const server = createServer((_request, response) => { response.writeHead(200, { "content-type": "text/html; charset=utf-8" }); response.end(fixture); });
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("fixture server did not start");
const base = `http://127.0.0.1:${address.port}`;
const fakePassword = "never-persist-this-fake-password";
const profile: Profile = { schemaVersion: 1, id: "outlook", name: "Fixture Outlook", workflow: "validate-login", adapter: "microsoft", targets: { login: `${base}/login?scenario=ready`, personalMailbox: `${base}/mail?scenario=ready`, organizationMailbox: `${base}/mail?scenario=ready` }, browser: { channel: "chromium", headless: true }, limits: { navigationTimeoutMs: 5_000, authTimeoutMs: 5_000, totalTimeoutMs: 10_000 } };

test("local fixture E2E writes a redacted VALID result and report", async () => {
  const artifacts = await mkdtemp(join(tmpdir(), "web-validation-"));
  try {
    const result = await runValidation({ profile, credentials: { username: "fake@example.test", password: fakePassword }, artifactRoot: artifacts });
    assert.equal(result.result, "VALID", JSON.stringify({ stage: result.stage, reason: result.reason }));
    const report = await readFile(join(artifacts, result.runId, "report.md"), "utf8");
    const json = await readFile(join(artifacts, result.runId, "result.json"), "utf8");
    assert.equal(report.includes(fakePassword), false);
    assert.equal(json.includes(fakePassword), false);
    assert.equal(result.evidence.trace, null);
  } finally { await rm(artifacts, { recursive: true, force: true }); }
});

test.after(() => server.close());
