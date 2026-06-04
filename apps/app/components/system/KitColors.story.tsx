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
import { AppModal } from '../AppModal';
import { ColorPicker } from './ColorPicker';
import {
  setOverride, resetOverrides, isHex, type TokenKey,
} from '../../lib/colorOverrides';
import {
  useRadius, useBlockRadius, setRadius, setBlockRadius, resetRadius,
} from '../../lib/theme';
import { RADIUS_MIN, RADIUS_MAX } from '@metro-labs/kit/tokens';

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
  const [picking, setPicking] = useState(false);
  // While the picker is open, `pending` holds the un-applied color so Cancel
  // can discard it. Apply commits via setOverride; Cancel restores `value`.
  const [pending, setPending] = useState<string | null>(null);
  const shown = draft ?? value;
  const invalid = draft != null && !isHex(draft);
  const closePicker = (): void => { setPicking(false); setPending(null); };
  return (
    <Row gap={14} mt={12} style={{ alignItems: 'center' }}>
      <Pressable
        onPress={() => { setPending(value); setPicking(true); }}
        accessibilityLabel={`Pick ${name} color`}
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
      <AppModal visible={picking} onClose={closePicker} title={name}>
        <ColorPicker value={pending ?? value} onChange={setPending} p={p} />
        <Row gap={12} mt={20} style={{ alignItems: 'center' }}>
          <Pressable
            onPress={closePicker}
            style={{
              flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
              borderWidth: 1, borderColor: p.border, backgroundColor: p.rowBg,
            }}
          >
            <Text style={{ color: p.head, fontSize: 15, fontFamily: 'Calibre-Semibold' }}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (pending != null && isHex(pending)) setOverride(tokenKey, scheme, pending);
              closePicker();
            }}
            style={{
              flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
              backgroundColor: p.head,
            }}
          >
            <Text style={{ color: p.rowBg, fontSize: 15, fontFamily: 'Calibre-Semibold' }}>
              Apply
            </Text>
          </Pressable>
        </Row>
      </AppModal>
    </Row>
  );
}

/** Editable numeric radius token row: px input + live rounded preview. Clamped
 *  to [MIN,MAX]. Used for both button-border-radius + border-radius tokens. */
function RadiusRow({ p, name, value, onSet }: {
  p: ControlPalette; name: string; value: number; onSet: (n: number) => void;
}): React.ReactElement {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  return (
    <Row gap={14} mt={12} style={{ alignItems: 'center' }}>
      <Box style={{
        width: 40, height: 40, borderRadius: Math.min(value, 20),
        backgroundColor: p.rowBg, borderWidth: 1, borderColor: p.head,
      }} />
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: p.head, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>
          {name}
        </Text>
        <TextInput
          value={shown}
          onChangeText={(t) => {
            setDraft(t);
            const n = Number(t.replace(/[^0-9]/g, ''));
            if (Number.isFinite(n) && t.trim() !== '') onSet(n);
          }}
          onBlur={() => setDraft(null)}
          keyboardType="numeric"
          placeholder={`${RADIUS_MIN}–${RADIUS_MAX} px`}
          placeholderTextColor={p.sub}
          style={{
            marginTop: 2, paddingVertical: 2, paddingHorizontal: 0,
            color: p.sub, fontSize: 13, fontFamily: 'Calibre-Medium',
          }}
        />
      </Box>
    </Row>
  );
}

/** Both radius token rows: button-border-radius + border-radius. */
function RadiusRows({ p }: { p: ControlPalette }): React.ReactElement {
  const buttonRadius = useRadius();
  const blockRadius = useBlockRadius();
  return (
    <>
      <RadiusRow p={p} name="button-border-radius" value={buttonRadius} onSet={setRadius} />
      <RadiusRow p={p} name="border-radius" value={blockRadius} onSet={setBlockRadius} />
    </>
  );
}

export function KitColorsStory({ p }: { p: ControlPalette }): React.ReactElement {
  const palette = usePalette();
  const scheme = useEffectiveColorScheme();
  return (
    <Box>
      <Row mt={16} align="center" justify="between">
        <Text dark={p.dark} color={p.sub} variant="caption" weight="medium">
          {`${TOKEN_ROWS.length} tokens + 2 radii · tap a swatch or hex · ${scheme}`}
        </Text>
        <Pressable
          onPress={() => { resetOverrides(); resetRadius(); }}
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
        <RadiusRows p={p} />
      </Box>
    </Box>
  );
}
