export interface Credentials { username: string; password: string; }

export function readCredentials(environment: NodeJS.ProcessEnv): Credentials {
  const username = environment.WEBTEST_USERNAME?.trim();
  const password = environment.WEBTEST_PASSWORD;
  if (!username || !password) throw new Error("CREDENTIALS_MISSING");
  return { username, password };
}
