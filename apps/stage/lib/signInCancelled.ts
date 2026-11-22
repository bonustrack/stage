export class SignInCancelled extends Error {
  constructor(message = 'Sign-in was cancelled.') {
    super(message);
    this.name = 'SignInCancelled';
  }
}
