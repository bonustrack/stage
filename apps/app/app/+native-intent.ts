/**
 * @file expo-router native-intent: redirect bare/dev-client launch URLs (e.g.
 *  `stage://expo-development-client/?url=...`, bare `stage://`, Expo-Go `exp://`)
 *  to the app root so dev-client previews open to Home instead of +not-found; real deep links pass through untouched (see git for the full rationale).
 */

/** True for URLs that merely *launch* the app (dev-client/Expo-Go shells, bare scheme) and carry no real in-app route. */
function isLaunchUrl(path: string): boolean {
  const url = path.trim();
  // expo-dev-client / expo-go launch shells: the route segment is the launcher
  // itself, not an app screen.
  if (/^[a-z][a-z0-9+.-]*:\/\/expo-development-client(\/|\?|$)/i.test(url)) return true;
  if (/^exp(\+[a-z0-9.-]+)?:\/\//i.test(url) && !url.includes('/--/')) return true;
  // Bare custom-scheme launch with no path after the authority, e.g. `stage://`
  // or `stage:///` — nothing to route to, so land on Home.
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^?#]*)/i.exec(url);
  if (m) {
    const authorityAndPath = (m[1] ?? '').replace(/\/+$/, '');
    if (authorityAndPath === '') return true;
  }
  return false;
}

/** expo-router calls this with the raw launch URL (cold start + warm links): return '/' for launch URLs, else the original path for the router to match. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return isLaunchUrl(path) ? '/' : path;
}
