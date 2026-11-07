import { ignored } from '../../lib/errorPolicy';
import { isBrowserExtension } from '../../lib/extension';
import { bootMessaging } from '../../lib/messaging/boot';
import { currentRoute } from '../../lib/navigation';
import { isOnboardingRoute } from '../tabs/pages';

export function bootWebMessaging(): void {
  if (isBrowserExtension() || isOnboardingRoute(currentRoute('').replace(/\?.*$/, ''))) return;
  void bootMessaging(true).catch(ignored(undefined, 'optional'));
}
