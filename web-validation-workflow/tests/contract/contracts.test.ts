import assert from "node:assert/strict";
import test from "node:test";

import { parseProfile } from "../../src/contracts/profile.js";
import { RESULTS, exitCodeFor, makeResult } from "../../src/contracts/result.js";
import { readCredentials } from "../../src/contracts/credentials.js";

const profile = {
  schemaVersion: 1,
  id: "outlook",
  name: "Microsoft Outlook",
  workflow: "validate-login",
  adapter: "microsoft",
  targets: {
    login: "https://login.microsoftonline.com/",
    personalMailbox: "https://outlook.live.com/mail/",
    organizationMailbox: "https://outlook.office.com/mail/"
  },
  browser: { channel: "msedge", headless: true },
  limits: { navigationTimeoutMs: 1, authTimeoutMs: 2, totalTimeoutMs: 3 }
};

test("accepts a complete credential-free outlook profile", () => {
  assert.equal(parseProfile(profile).id, "outlook");
});

test("rejects non-https profile URLs before browser launch", () => {
  assert.throws(() => parseProfile({ ...profile, targets: { ...profile.targets, login: "http://example.test" } }));
});

test("allows HTTP only for local fixture hosts", () => {
  const local = parseProfile({ ...profile, targets: { login: "http://127.0.0.1:1234/login", personalMailbox: "http://localhost:1234/mail", organizationMailbox: "http://[::1]:1234/mail" } });
  assert.equal(local.targets.login.startsWith("http://127.0.0.1"), true);
});

test("maps only the four contract results to stable exit codes", () => {
  assert.deepEqual(RESULTS.map(exitCodeFor), [0, 10, 20, 30]);
  assert.equal(makeResult({ result: "VALID", profile: "outlook", runId: "run" }).reason, "MAILBOX_READY");
});

test("requires one non-empty runtime username and password", () => {
  assert.throws(() => readCredentials({ WEBTEST_USERNAME: "fake@example.test" }));
  assert.equal(readCredentials({ WEBTEST_USERNAME: "fake@example.test", WEBTEST_PASSWORD: "secret" }).username, "fake@example.test");
});
