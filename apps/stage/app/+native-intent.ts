import { isAppLaunchUrl } from '@stage-labs/client/routing/stageLinks';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return isAppLaunchUrl(path) ? '/' : path;
}
