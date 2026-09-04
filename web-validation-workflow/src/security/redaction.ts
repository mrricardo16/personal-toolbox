const sensitiveKeys = /password|authorization|cookie|token|secret/i;

export function redact(value: unknown, secrets: readonly string[] = []): unknown {
  if (typeof value === "string") return secrets.reduce((text, secret) => secret ? text.split(secret).join("[REDACTED]") : text, value);
  if (Array.isArray(value)) return value.map((item) => redact(item, secrets));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitiveKeys.test(key) ? "[REDACTED]" : redact(item, secrets)]));
  return value;
}

export function safeErrorMessage(error: unknown, secrets: readonly string[]): string {
  const message = error instanceof Error ? error.message : "WORKFLOW_ERROR";
  return String(redact(message, secrets));
}
