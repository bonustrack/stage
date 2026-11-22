export const EMAIL_CODE_LENGTH = 6;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailAddressOf(raw: string): string | null {
  const email = raw.trim();
  return EMAIL_PATTERN.test(email) ? email : null;
}

export function emailCodeOf(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, EMAIL_CODE_LENGTH);
}

export function isFullEmailCode(code: string): boolean {
  return code.length === EMAIL_CODE_LENGTH;
}

export interface EmailSignInCopy {
  title: string;
  about: string;
  action: string;
}

export function emailSignInCopy(sentTo: string | null): EmailSignInCopy {
  if (sentTo === null) {
    return { title: 'Continue with email', about: 'We will email you a 6-digit code. No password needed.', action: 'Send code' };
  }
  return { title: 'Check your email', about: `Enter the 6-digit code sent to ${sentTo}. It expires in 10 minutes.`, action: 'Continue' };
}
