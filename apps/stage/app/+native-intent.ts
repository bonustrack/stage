function isLaunchUrl(path: string): boolean {
  const url = path.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\/expo-development-client(\/|\?|$)/i.test(url)) return true;
  if (/^exp(\+[a-z0-9.-]+)?:\/\//i.test(url) && !url.includes('/--/')) return true;
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^?#]*)/i.exec(url);
  return m !== null && (m[1] ?? '').replace(/\/+$/, '') === '';
}

const SIGN_IN_RETURN = /[?&]privy_oauth_(code|state)=/;

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  if (SIGN_IN_RETURN.test(path)) return initial ? '/' : '';
  return isLaunchUrl(path) ? '/' : path;
}
