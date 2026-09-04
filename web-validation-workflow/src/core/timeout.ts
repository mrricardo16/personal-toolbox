export class WorkflowTimeoutError extends Error { public constructor() { super("NAVIGATION_TIMEOUT"); } }

export async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([operation, new Promise<T>((_resolve, reject) => { timer = setTimeout(() => reject(new WorkflowTimeoutError()), timeoutMs); })]);
  } finally { if (timer) clearTimeout(timer); }
}
