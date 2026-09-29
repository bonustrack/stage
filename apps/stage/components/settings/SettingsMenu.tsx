import type { SimultaneousRefs } from '../SwipeTabs.types';
import { SettingsPage } from './SettingsPage';
import { SettingsAboutFooter } from './SettingsAboutFooter';
import { SettingsHub } from './SettingsHub';

export function SettingsMenu({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  return (
    <SettingsPage title="Settings" root panRef={panRef}>
      <SettingsHub />
      <SettingsAboutFooter />
    </SettingsPage>
  );
}
