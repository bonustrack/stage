import { useRouter } from 'expo-router';
import { Text } from '@stage-labs/kit/react-native/text';
import {
  PROFILE_SETTINGS_HREF, SETTINGS_MENU_SECTIONS, menuItemValue,
} from './SettingsMenu.model';
import { themeLabel } from './themeOptions.model';
import { capabilities } from '../../lib/capabilities';
import { useCustomTheme, useThemePreference } from '../../lib/theme';
import { versionLabel } from '../../lib/appVersion';
import { Col, PAGE_GUTTER } from '../layout';
import { SettingsGroup, SettingsPage } from './SettingsPage';
import { SettingsMenuRow } from './rows';
import { SettingsAccountHeader } from './SettingsAccountHeader';
import { useActiveAccountRecord } from '../../modules/messaging';
import { profileLinkOf } from '../../lib/links';

export function SettingsMenu(): React.ReactElement {
  const router = useRouter();
  const address = useActiveAccountRecord()?.address ?? null;
  const hints = { theme: themeLabel(useThemePreference(), useCustomTheme()) };
  const openProfile = (): void => {
    if (address) router.push(profileLinkOf(address));
    else capabilities.navigate(PROFILE_SETTINGS_HREF);
  };
  return (
    <SettingsPage title="Settings" root>
      <Col gap={24} padding={{ x: PAGE_GUTTER, top: 16 }}>
        <SettingsAccountHeader onOpenProfile={openProfile} />
        {SETTINGS_MENU_SECTIONS.map((section) => (
          <SettingsGroup key={section.title ?? 'more'} title={section.title}>
            {section.items.map((item) => (
              <SettingsMenuRow
                key={item.href}
                label={item.label}
                iconStart={item.icon}
                value={menuItemValue(item, hints)}
                onPress={() => { capabilities.navigate(item.href); }}
              />
            ))}
          </SettingsGroup>
        ))}
        <Text size="xs" color="secondary" textAlign="center">{`Stage ${versionLabel()}`}</Text>
      </Col>
    </SettingsPage>
  );
}
