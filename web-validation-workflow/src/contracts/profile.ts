export interface Profile {
  schemaVersion: 1;
  id: string;
  name: string;
  workflow: "validate-login";
  adapter: "microsoft";
  targets: { login: string; personalMailbox: string; organizationMailbox: string };
  browser: { channel: "msedge" | "chromium"; headless: boolean };
  limits: { navigationTimeoutMs: number; authTimeoutMs: number; totalTimeoutMs: number };
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`PROFILE_INVALID:${name}`);
  return value;
}

function httpsUrl(value: unknown, name: string): string {
  const raw = requiredString(value, name);
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error(`PROFILE_INVALID:${name}`); }
  const isLoopbackFixture = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLoopbackFixture) throw new Error(`PROFILE_INVALID:${name}`);
  return url.toString();
}

function positive(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new Error(`PROFILE_INVALID:${name}`);
  return value;
}

export function parseProfile(value: unknown): Profile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("PROFILE_INVALID:root");
  const input = value as Record<string, unknown>;
  const targets = input.targets as Record<string, unknown>;
  const browser = input.browser as Record<string, unknown>;
  const limits = input.limits as Record<string, unknown>;
  if (input.schemaVersion !== 1 || input.workflow !== "validate-login" || input.adapter !== "microsoft") throw new Error("PROFILE_INVALID:contract");
  if (!targets || !browser || !limits || typeof browser.headless !== "boolean" || (browser.channel !== "msedge" && browser.channel !== "chromium")) throw new Error("PROFILE_INVALID:shape");
  const parsed: Profile = {
    schemaVersion: 1, id: requiredString(input.id, "id"), name: requiredString(input.name, "name"), workflow: "validate-login", adapter: "microsoft",
    targets: { login: httpsUrl(targets.login, "targets.login"), personalMailbox: httpsUrl(targets.personalMailbox, "targets.personalMailbox"), organizationMailbox: httpsUrl(targets.organizationMailbox, "targets.organizationMailbox") },
    browser: { channel: browser.channel, headless: browser.headless },
    limits: { navigationTimeoutMs: positive(limits.navigationTimeoutMs, "limits.navigationTimeoutMs"), authTimeoutMs: positive(limits.authTimeoutMs, "limits.authTimeoutMs"), totalTimeoutMs: positive(limits.totalTimeoutMs, "limits.totalTimeoutMs") }
  };
  if (parsed.limits.authTimeoutMs > parsed.limits.totalTimeoutMs) throw new Error("PROFILE_INVALID:timeouts");
  return parsed;
}
