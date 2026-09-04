export const microsoftSelectors = {
  username: ["input[autocomplete='username']", "input[name='loginfmt']", "#i0116", "input[type='email']"],
  password: ["input[type='password']", "input[autocomplete='current-password']", "#i0118"],
  submit: ["button[type='submit']", "input[type='submit']", "#idSIButton9"],
  mailboxUnavailable: /mailbox\s+(is\s+)?unavailable|邮箱.*不可用/i,
  accountNotFound: /couldn'?t find an account|找不到.*帐户|找不到.*账户/i,
  invalidCredentials: /account or password is incorrect|密码.*不正确|密码.*错误/i,
  mfa: /authenticator|enter code|验证码|多重验证|mfa/i,
  captcha: /captcha|安全挑战/i,
  locked: /account has been locked|帐户.*锁定|账户.*锁定/i,
  federated: /sign in with your organization|联合|federated/i,
  policy: /conditional access|访问策略|policy/i
} as const;
