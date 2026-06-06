/** Settings → Components route — the app-level UI component showcase (UserCard /
 *  ChannelCard / TokenCard) + a theme switcher, as its own Settings sub-page.
 *  Reached via /settings → "Components" row. */

import { ComponentsPage } from '../../components/system/ComponentsPage';

export default function SettingsComponentsRoute(): React.ReactElement {
  return <ComponentsPage />;
}
