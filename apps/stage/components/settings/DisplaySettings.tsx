

import { Box, PAGE_GUTTER } from '../layout';
import { Eyebrow } from '../Eyebrow';
import {
  setThemePreference, setCustomTheme, useCustomTheme,
  useThemePreference,
} from '../../lib/theme';
import { THEME_OPTIONS } from './themeOptions.model';
import { ColorTokens } from '../system/ColorTokens';
import { SettingsPage } from './SettingsPage';
import { SettingsList, SettingsThemeRow } from './rows';
import { IconColorSwatch } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconColorSwatch';

export function DisplaySettings(): React.ReactElement {
  const pref = useThemePreference();
  const custom = useCustomTheme();

  return (
    <SettingsPage title="Display" keyboardShouldPersistTaps="handled">
      <Eyebrow style={{ paddingHorizontal: PAGE_GUTTER, paddingTop: 20, paddingBottom: 8 }}>
        THEME
      </Eyebrow>
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
          iconName={IconColorSwatch}
          selected={custom}
          onPress={() => { setCustomTheme(true); }}
        />
      </SettingsList>

      {custom ? (
        <Box padding={{ x: PAGE_GUTTER, top: 24 }}>
          <Eyebrow style={{ paddingBottom: 4 }}>
            CUSTOM COLORS
          </Eyebrow>
          <ColorTokens/>
        </Box>
      ) : null}
    </SettingsPage>
  );
}
