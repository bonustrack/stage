import { describe, expect, test } from 'bun:test';
import { emailAddressOf, emailCodeOf, emailSignInCopy, isFullEmailCode } from '../components/privy/EmailSignIn.model';

describe('emailAddressOf', () => {
  test('accepts an address with spaces around it and returns it trimmed', () => {
    expect(emailAddressOf('  ada@example.com ')).toBe('ada@example.com');
    expect(emailAddressOf('first.last+tag@mail.example.org')).toBe('first.last+tag@mail.example.org');
  });

  test('refuses text that is not an address', () => {
    expect(emailAddressOf('')).toBeNull();
    expect(emailAddressOf('ada')).toBeNull();
    expect(emailAddressOf('ada@example')).toBeNull();
    expect(emailAddressOf('ada @example.com')).toBeNull();
  });
});

describe('emailCodeOf', () => {
  test('keeps the first six digits of a typed or pasted code', () => {
    expect(emailCodeOf('123 456')).toBe('123456');
    expect(emailCodeOf('Your code: 987-654-3')).toBe('987654');
    expect(emailCodeOf('12a')).toBe('12');
  });

  test('a code is complete at six digits', () => {
    expect(isFullEmailCode('12345')).toBe(false);
    expect(isFullEmailCode('123456')).toBe(true);
  });
});

describe('emailSignInCopy', () => {
  test('asks for the address first, then for the code sent to it', () => {
    expect(emailSignInCopy(null)).toEqual({
      title: 'Continue with email',
      about: 'We will email you a 6-digit code. No password needed.',
      action: 'Send code',
    });
    const sent = emailSignInCopy('ada@example.com');
    expect(sent.title).toBe('Check your email');
    expect(sent.about).toContain('ada@example.com');
    expect(sent.action).toBe('Continue');
  });
});
