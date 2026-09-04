# Web Validation Workflow

A Node.js, TypeScript, and Playwright MVP for deterministic Microsoft Outlook login and mailbox availability validation. It is not a browser Agent: any caller uses the same profile, runtime credential contract, CLI, exit code, and `result.json`.

```
Agent or script -> validate-login Workflow -> Microsoft Adapter -> Playwright
```

`VALID` means both Microsoft authentication succeeded and Outlook mailbox UI was accessible. Authentication success alone is not enough.

## Install and run

Use Node.js 22+ and install dependencies:

```text
npm ci
npx playwright install chromium
npm run validate -- --profile outlook
```

`msedge` is preferred when available; the workflow falls back to Playwright Chromium when Edge cannot launch. Credentials are runtime secrets provided through the parent process (`WEBTEST_USERNAME` and `WEBTEST_PASSWORD`); never pass a password as a CLI argument or save one in a file. See [AGENTS.md](AGENTS.md) for the caller contract.

## Result and evidence

Exit codes are `0` VALID, `10` INVALID, `20` BLOCKED, and `30` ERROR. Each run writes `artifacts/<run-id>/result.json` and `report.md`. The JSON is the authoritative machine result. Reports contain only run metadata and diagnosis; screenshots and traces are disabled during authentication to avoid retaining secrets.

## Testing and CI

Run `npm run build`, `npm test`, and `npm run test:e2e`. The tests host local HTML fixtures for username, password, invalid account, invalid password, MFA, CAPTCHA, locked account, mailbox unavailable, mailbox ready, and unknown UI. CI never contacts Microsoft and never uses repository secrets for authentication.

## Security limits and non-goals

Every run creates and closes a fresh BrowserContext. The MVP has no batch mode, concurrency, password retry, persistent session, MFA/CAPTCHA/Conditional Access bypass, anti-bot evasion, mailbox reading/writing, or OAuth persistence. Real Microsoft validation remains a user-authorized manual follow-up and is not claimed by fixture tests.
