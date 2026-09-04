# Web Validation Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a secure, deterministic, agent-independent Outlook login and mailbox validation MVP.

**Architecture:** The CLI validates a credential-free profile and obtains one runtime credential pair from environment variables. `validate-login` orchestrates a Microsoft site adapter through a fresh Playwright BrowserContext, then writes redacted result and human report evidence. Fixtures exercise the same deterministic adapter state transitions without real Microsoft access.

**Tech Stack:** Node.js, TypeScript strict, Playwright, Node test runner, local HTML fixtures, GitHub Actions.

## Global Constraints

- One account, one password, one validation per process; no retry, batch, concurrency, session persistence, CAPTCHA/MFA/Conditional Access bypass, mail reading, or mail writing.
- Passwords never appear in CLI arguments, output, reports, JSON, filenames, traces, screenshots, source control, or artifacts.
- Each run uses a new BrowserContext and closes both context and browser.
- Top-level results are only VALID, INVALID, BLOCKED, and ERROR, with exit codes 0, 10, 20, and 30.
- CI uses only local fixtures and fake credentials.
- All created or changed text files use UTF-8.

### Task 1: Establish contracts and security primitives

**Files:** Create `web-validation-workflow/package.json`, `tsconfig.json`, `src/contracts/*.ts`, `src/security/*.ts`, and contract/security tests.

- [ ] Write tests for profile validation, result validation, exit code mapping, secret validation, and recursive redaction.
- [ ] Run the tests to observe missing-module failures.
- [ ] Implement strict contracts and redaction with no secret-preserving error path.
- [ ] Re-run the focused tests and ensure they pass.

### Task 2: Implement deterministic workflow and Microsoft adapter

**Files:** Create `src/core/*`, `src/workflows/*`, `src/adapters/*`, `src/browser/*`, `profiles/outlook.json`, fixture pages, and adapter/browser tests.

- [ ] Write adapter and browser-isolation tests for each fixture terminal state.
- [ ] Run them to observe failures before implementation.
- [ ] Implement finite state transitions, semantic selectors, mailbox readiness checks, and ephemeral browser lifecycle.
- [ ] Re-run adapter/browser tests and ensure they pass.

### Task 3: Add CLI, evidence, local E2E, and documentation

**Files:** Create `src/cli/validate.ts`, `src/evidence/*`, E2E tests, `.gitignore`, `README.md`, `AGENTS.md`, root README section, and CI workflow.

- [ ] Write end-to-end tests asserting valid local fixture output contains no fake password.
- [ ] Run them to observe CLI/output failures.
- [ ] Implement profile loading, environment-only secret intake, evidence writing, stable CLI exit codes, and safe docs/CI.
- [ ] Run build, full tests, E2E, secret scans, and Git checks.
