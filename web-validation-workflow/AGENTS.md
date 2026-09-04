# Web Validation Workflow Agent Contract

This is an agent-independent, deterministic login validation workflow. An agent is only a caller: it selects `outlook`, provides one explicitly authorized username/password pair at runtime, reads `result.json`, and reports the returned contract. It must not write temporary Playwright scripts or decide browser states itself.

## Safe invocation

Install dependencies with `npm ci`, then run `npm run validate -- --profile outlook`. Inject `WEBTEST_USERNAME` and `WEBTEST_PASSWORD` only through the calling process's secure runtime environment or an approved secret-injection mechanism. Do not put passwords in CLI arguments, source files, Git, `.env`, console transcripts, reports, or artifact names.

## Contract

The sole profile is `outlook`. Each invocation validates exactly one username and one password once. Read `artifacts/<run-id>/result.json`; do not override it based on screenshots. Results are `VALID`, `INVALID`, `BLOCKED`, or `ERROR`, with exit codes `0`, `10`, `20`, and `30` respectively. `VALID` means Microsoft authentication succeeded and Outlook mailbox access was confirmed.

Artifacts contain `result.json` and a password-free `report.md`. Authentication screenshots and traces are deliberately disabled in this MVP.

## DO NOT

- Do not pass `--password`, use another password, batch accounts, parallelize, or retry credentials.
- Do not bypass or automate MFA, CAPTCHA, OTP, device verification, federated SSO, Conditional Access, or anti-bot controls.
- Do not persist a browser profile, storage state, session, OAuth token, cookie, or credential.
- Do not read or write Outlook email.
- Do not test CI against Microsoft; CI uses only local fixtures with fake credentials.

Common outcomes: `INVALID_CREDENTIALS` and `ACCOUNT_NOT_FOUND` are invalid; `MFA_REQUIRED`, `CAPTCHA_REQUIRED`, `ACCOUNT_LOCKED`, `POLICY_BLOCKED`, and `FEDERATED_IDP_REQUIRED` are blocked; `UNKNOWN_AUTH_STATE` requires adapter maintenance rather than a guessed credential verdict.
