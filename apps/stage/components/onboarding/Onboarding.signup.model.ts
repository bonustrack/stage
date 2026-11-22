import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';

export const SIGNUP_COPY = {
  title: 'Welcome to Stage',
  about: 'Private, encrypted messaging. Sign in or create an account to start.',
} as const;

export interface SignUpLayout {
  email: boolean;
  buttons: PrivyLoginMethod[];
  createOnPage: boolean;
  importOnPage: boolean;
  separator: boolean;
}

export function signUpLayout(methods: readonly PrivyLoginMethod[]): SignUpLayout {
  const email = methods.includes('email');
  const walletPicker = methods.includes('wallet');
  const buttons = methods.filter((method) => method !== 'email');
  return {
    email,
    buttons,
    createOnPage: !walletPicker,
    importOnPage: !walletPicker,
    separator: (email || !walletPicker) && buttons.length > 0,
  };
}

export const PLACEHOLDER_BUTTONS = 3;
