

import { Box, PAGE_GUTTER } from '../layout';
import { Text } from '@stage-labs/kit/react-native/text';
import {
  setThemePreference, setCustomTheme, useCustomTheme,
  useThemePreference,
} from '../../lib/theme';
import { THEME_OPTIONS } from './themeOptions.model';
import { ColorTokens } from '../system/ColorTokens';
import { SettingsPage } from './SettingsPage';
import { SettingsList, SettingsThemeRow } from './rows';

export function DisplaySettings(): React.ReactElement {
  const pref = useThemePreference();
  const custom = useCustomTheme();

  return (
    <SettingsPage title="Display" keyboardShouldPersistTaps="handled">
      <Text size="xs" role="secondary" style={{ paddingHorizontal: PAGE_GUTTER, paddingTop: 20, paddingBottom: 8 }}>
        THEME
      </Text>
      <SettingsList>
        {THEME_OPTIONS.map((opt) => (
          <SettingsThemeRow
            key={opt.value}
            label={opt.label}
            iconName={opt.icon}
            selected={!custom && pref === opt.value}
            onPress={() => {
              setCustomTheme(false);
              void setThemePreference(opt.value);
            }}
          />
        ))}
        <SettingsThemeRow
          label="Custom"
          iconName="colorSwatch"
          selected={custom}
          onPress={() => { setCustomTheme(true); }}
        />
      </SettingsList>

      {custom ? (
        <Box padding={{ x: PAGE_GUTTER, top: 24 }}>
          <Text size="xs" role="secondary" style={{ paddingBottom: 4 }}>
            CUSTOM COLORS
          </Text>
          <ColorTokens/>
        </Box>
      ) : null}
    </SettingsPage>
  );
}
