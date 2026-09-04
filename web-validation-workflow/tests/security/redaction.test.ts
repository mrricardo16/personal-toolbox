import assert from "node:assert/strict";
import test from "node:test";

import { redact } from "../../src/security/redaction.js";

test("redacts supplied secrets and sensitive fields recursively", () => {
  const secret = "fake-password-123";
  const value = redact({ password: secret, nested: { Authorization: "Bearer token", message: `failed ${secret}` } }, [secret]);
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes("Bearer token"), false);
  assert.equal(serialized.includes("[REDACTED]"), true);
});
