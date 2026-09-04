import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";

import { MicrosoftAdapter } from "../../src/adapters/microsoft/microsoft-adapter.js";
import { createIsolatedContext } from "../../src/browser/isolation.js";
import type { Profile } from "../../src/contracts/profile.js";

const fixture = await readFile("fixtures/microsoft/index.html");
const server = createServer((request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(fixture);
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("fixture server did not start");
const base = `http://127.0.0.1:${address.port}`;

function profile(scenario: string): Profile {
  return { schemaVersion: 1, id: "outlook", name: "Fixture Outlook", workflow: "validate-login", adapter: "microsoft", targets: { login: `${base}/login?scenario=${scenario}`, personalMailbox: `${base}/mail?scenario=${scenario}`, organizationMailbox: `${base}/mail?scenario=${scenario}` }, browser: { channel: "chromium", headless: true }, limits: { navigationTimeoutMs: 5_000, authTimeoutMs: 5_000, totalTimeoutMs: 10_000 } };
}

for (const [scenario, expected] of Object.entries({ "account-not-found": "ACCOUNT_NOT_FOUND", "invalid-password": "INVALID_CREDENTIALS", mfa: "MFA_REQUIRED", captcha: "CAPTCHA_REQUIRED", locked: "ACCOUNT_LOCKED", unknown: "UNKNOWN_AUTH_STATE", ready: "MAILBOX_READY", "mailbox-unavailable": "MAILBOX_UNAVAILABLE" })) {
  test(`classifies fixture ${scenario}`, async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await createIsolatedContext(browser);
    try {
      const adapter = new MicrosoftAdapter(await context.newPage());
      const result = await adapter.validate({ username: "fake@example.test", password: "fake-password" }, profile(scenario));
      assert.equal(result.reason, expected);
    } finally { await context.close(); await browser.close(); }
  });
}

test("uses separate BrowserContexts without cookie sharing", async () => {
  const browser = await chromium.launch({ headless: true });
  const one = await createIsolatedContext(browser);
  const two = await createIsolatedContext(browser);
  try {
    await one.addCookies([{ name: "test", value: "one", domain: "example.test", path: "/" }]);
    assert.equal((await two.cookies("https://example.test")).length, 0);
  } finally { await one.close(); await two.close(); await browser.close(); }
});

test("uses the organization mailbox when the personal mailbox is unavailable", async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await createIsolatedContext(browser);
  try {
    const organizationProfile = profile("organization-only");
    organizationProfile.targets.personalMailbox = `${base}/mail?scenario=organization-only&kind=personal`;
    organizationProfile.targets.organizationMailbox = `${base}/mail?scenario=organization-only&kind=organization`;
    const adapter = new MicrosoftAdapter(await context.newPage());
    const result = await adapter.validate({ username: "fake@example.test", password: "fake-password" }, organizationProfile);
    assert.equal(result.reason, "MAILBOX_READY");
    assert.equal(result.result, "VALID");
  } finally { await context.close(); await browser.close(); }
});

test.after(() => server.close());
