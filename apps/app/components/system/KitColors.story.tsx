/** Colors story tab — enumerates EVERY named color variable the app palette
 *  exposes (lib/theme.ts `Palette`) for the active theme, one EDITABLE swatch
 *  row each: a small rounded box filled with the value + the variable name +
 *  a `#rrggbb` text input. Editing a hex writes a per-scheme override
 *  (lib/colorOverrides.ts) → usePalette() merges it → the whole app re-themes
 *  live. A Reset button restores all kit defaults.
 *  Fonts: Calibre-Medium / Calibre-Semibold only. */

import { useState } from 'react';
import { Pressable, TextInput } from 'react-native';
import { Box, Row } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { usePalette, useEffectiveColorScheme, type Palette } from '../../lib/theme';
import { type ControlPalette } from './KitControls';
import {
  setOverride, resetOverrides, isHex, type TokenKey,
} from '../../lib/colorOverrides';

/** The 7 canonical palette keys in display order. `key` is both the Palette key
 *  and the override TokenKey (they share the same union). */
const TOKEN_ROWS: ReadonlyArray<readonly [label: string, key: keyof Palette]> = [
  ['bg-color', 'bg'],
  ['border-color', 'border'],
  ['text-color', 'text'],
  ['link-color', 'link'],
  ['primary-color', 'primary'],
  ['danger-color', 'danger'],
  ['success-color', 'success'],
];

function EditableSwatch({ name, tokenKey, value, scheme, p }: {
  name: string; tokenKey: TokenKey; value: string;
  scheme: 'light' | 'dark'; p: ControlPalette;
}): React.ReactElement {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const invalid = draft != null && !isHex(draft);
  return (
    <Row gap={14} mt={12} style={{ alignItems: 'center' }}>
      <Box
        style={{
          width: 40, height: 40, borderRadius: 10,
          backgroundColor: value,
          borderWidth: 1, borderColor: p.border,
        }}
      />
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: p.head, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>
          {name}
        </Text>
        <TextInput
          value={shown}
          onChangeText={(t) => {
            setDraft(t);
            if (isHex(t)) setOverride(tokenKey, scheme, t);
          }}
          onBlur={() => setDraft(null)}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="#rrggbb"
          placeholderTextColor={p.sub}
          style={{
            marginTop: 2, paddingVertical: 2, paddingHorizontal: 0,
            color: invalid ? '#eb4c5b' : p.sub,
            fontSize: 13, fontFamily: 'Calibre-Medium',
          }}
        />
      </Box>
    </Row>
  );
}

export function KitColorsStory({ p }: { p: ControlPalette }): React.ReactElement {
  const palette = usePalette();
  const scheme = useEffectiveColorScheme();
  return (
    <Box>
      <Row mt={16} align="center" justify="between">
        <Text dark={p.dark} color={p.sub} variant="caption" weight="medium">
          {`${TOKEN_ROWS.length} tokens · tap a hex to edit · ${scheme}`}
        </Text>
        <Pressable
          onPress={() => resetOverrides()}
          hitSlop={8}
          style={{
            paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10,
            borderWidth: 1, borderColor: p.border, backgroundColor: p.rowBg,
          }}
          accessibilityLabel="Reset color tokens to defaults"
        >
          <Text style={{ color: p.head, fontSize: 14, fontFamily: 'Calibre-Semibold' }}>
            Reset
          </Text>
        </Pressable>
      </Row>
      <Box mt={2}>
        {TOKEN_ROWS.map(([label, key]) => (
          <EditableSwatch
            key={label} name={label} tokenKey={key}
            value={palette[key]} scheme={scheme} p={p}
          />
        ))}
      </Box>
    </Box>
  );
}
