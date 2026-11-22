import { describe, expect, test } from 'bun:test';
import { signUpLayout } from '../components/onboarding/Onboarding.signup.model';

describe('signUpLayout', () => {
  test('the email field comes first, create and import live in the wallet picker', () => {
    expect(signUpLayout(['google', 'github', 'email', 'wallet'])).toEqual({
      email: true,
      buttons: ['google', 'github', 'wallet'],
      createOnPage: false,
      importOnPage: false,
      separator: true,
    });
  });

  test('without the wallet option the page keeps Create account and Or import', () => {
    expect(signUpLayout(['google', 'email'])).toEqual({
      email: true,
      buttons: ['google'],
      createOnPage: true,
      importOnPage: true,
      separator: true,
    });
  });

  test('with nothing but the wallet there is no separator', () => {
    expect(signUpLayout(['wallet'])).toEqual({
      email: false,
      buttons: ['wallet'],
      createOnPage: false,
      importOnPage: false,
      separator: false,
    });
  });

  test('a build with no sign-in method still creates and imports accounts', () => {
    expect(signUpLayout([])).toEqual({ email: false, buttons: [], createOnPage: true, importOnPage: true, separator: false });
  });
});
