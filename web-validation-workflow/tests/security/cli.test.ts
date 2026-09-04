import assert from "node:assert/strict";
import test from "node:test";

import { parseCliArguments } from "../../src/cli/validate.js";

test("accepts only the required profile argument", () => {
  assert.deepEqual(parseCliArguments(["--profile", "outlook"]), { profile: "outlook" });
});

test("rejects passwords and all unsupported CLI options", () => {
  assert.throws(() => parseCliArguments(["--profile", "outlook", "--password", "fake-password"]), /CLI_ARGUMENT_INVALID/);
  assert.throws(() => parseCliArguments(["--profiles", "outlook"]), /CLI_ARGUMENT_INVALID/);
});
