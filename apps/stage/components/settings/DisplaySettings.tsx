import {
  setThemePreference, setCustomTheme, useCustomTheme,
  useThemePreference,
} from '../../lib/theme';
import { ColorTokens } from '../system/ColorTokens';
import {
  SettingsGroup, SettingsPage, SettingsSectionLabel, SettingsThemeRow, THEME_OPTIONS,
} from './SettingsPage';
import { IconColorSwatch } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconColorSwatch';
import { Column, PAGE_GUTTER } from '../layout';

export function DisplaySettings(): React.ReactElement {
  const pref = useThemePreference();
  const custom = useCustomTheme();

  return (
    <SettingsPage title="Appearance" keyboardShouldPersistTaps="handled">
      <SettingsGroup title="Theme" footnote="System follows the light or dark mode of this device.">
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
      </SettingsGroup>

      {custom ? (
        <>
          <SettingsSectionLabel>Custom colors</SettingsSectionLabel>
          <Column padding={{ x: PAGE_GUTTER }}>
            <ColorTokens/>
          </Column>
        </>
      ) : null}
    </SettingsPage>
  );
}
