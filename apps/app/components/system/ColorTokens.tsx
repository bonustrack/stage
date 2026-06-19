/** ChatKit SEED theme editor for the Display settings page. Instead of editing 9
 *  flat hex tokens, the user sets a few SEEDS and the whole palette is DERIVED
 *  (lib/colorOverrides -> @metro-labs/kit derivePalette):
 *    - grayscale base  (neutral ramp -> border/inputBg/sub)
 *    - accent          (interactive emphasis -> link/primary)
 *    - surface bg      (main fill -> bg/toolbar)
 *    - surface fg      (default body text -> text)
 *  Plus the ChatKit non-color knobs: density, radius (name), typography base
 *  size. Edits write the seed so the whole app re-themes live. Reset restores
 *  the default seed (today's exact look). Fonts: Calibre-Medium/Semibold only. */

import { useState } from 'react';
import { Pressable } from '@metro-labs/kit/pressable';
import { Input } from '@metro-labs/kit/input';
import { Box, Row, Col } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import {
  usePalette, useEffectiveColorScheme, useThemeSeeds,
  setSeedColor, setSeedDensity, setSeedRadius, setSeedBaseSize, resetOverrides,
  type SeedColorKey,
} from '../../lib/theme';
import type { GalleryPalette } from './galleryPalette';
import { AppModal } from '../AppModal';
import { ColorPicker } from './ColorPicker';
import { isHex } from '../../lib/colorOverrides';
import {
  fontSize, type Density, type RadiusName, type BaseSize,
} from '@metro-labs/kit/tokens';

/** The 4 editable seed colors in display order. `key` is the SeedColorKey. */
const SEED_ROWS: readonly (readonly [label: string, key: SeedColorKey])[] = [
  ['surface-background', 'background'],
  ['surface-foreground', 'foreground'],
  ['accent', 'accent'],
  ['grayscale', 'grayscale'],
];

const DENSITY_OPTS: readonly Density[] = ['compact', 'normal', 'spacious'];
const RADIUS_OPTS: readonly RadiusName[] = ['pill', 'round', 'soft', 'sharp'];
const BASE_SIZE_OPTS: readonly BaseSize[] = [14, 15, 16, 17, 18];

/** The Seed Swatch component. */
function SeedSwatch({ name, seedKey, value, scheme, p }: {
  name: string; seedKey: SeedColorKey; value: string;
  scheme: 'light' | 'dark'; p: GalleryPalette;
}): React.ReactElement {
  const [draft, setDraft] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const shown = draft ?? value;
  const invalid = draft != null && !isHex(draft);
  /** Close Picker. */
  const closePicker = (): void => { setPicking(false); setPending(null); };
  return (
    <Row margin={{ top: 12 }} gap={14} align="center">
      <Pressable
        onPress={() => { setPending(value); setPicking(true); }}
        accessibilityLabel={`Pick ${name} color`}
        style={{
          width: 40, height: 40, borderRadius: 10, backgroundColor: value,
          borderWidth: 1, borderColor: p.border,
        }}
/>
      <Col minWidth={0} flex={1}>
        <Text weight="semibold" size="md" color={p.head}>{name}</Text>
        <Input
          value={shown}
          onChangeText={(t) => { setDraft(t); if (isHex(t)) setSeedColor(scheme, seedKey, t); }}
          dark={p.dark}
          inputProps={{ onBlur: () => { setDraft(null); }, autoCapitalize: 'none', autoCorrect: false }}
          placeholder="#rrggbb" placeholderTextColor={p.sub}
          style={{
            marginTop: 2, paddingVertical: 2, paddingHorizontal: 0, minHeight: 0,
            backgroundColor: 'transparent', borderWidth: 0,
            color: invalid ? '#eb4c5b' : p.sub, fontSize: fontSize('xs'), fontFamily: 'Calibre-Medium',
          }}
/>
      </Col>
      <AppModal visible={picking} onClose={closePicker}>
        <ColorPicker value={pending ?? value} onChange={setPending} p={p}/>
        <Row margin={{ top: 20 }} gap={12} align="center">
          <Button variant="secondary" dark={p.dark} onPress={closePicker} label="Cancel" style={{ flex: 1 }}/>
          <Button
            variant="primary" dark={p.dark}
            onPress={() => {
              if (pending != null && isHex(pending)) setSeedColor(scheme, seedKey, pending);
              closePicker();
            }}
            label="Apply" style={{ flex: 1 }}
/>
        </Row>
      </AppModal>
    </Row>
  );
}

/** A labelled segmented selector for one ChatKit non-color seed (density/radius/
 *  typography). Generic over the option value so each knob reuses it. */
function SeedChoice<T extends string | number>({ name, options, value, onSelect, p }: {
  name: string; options: readonly T[]; value: T; onSelect: (v: T) => void; p: GalleryPalette;
}): React.ReactElement {
  return (
    <Box margin={{ top: 16 }}>
      <Text weight="semibold" size="md" color={p.head}>{name}</Text>
      <Row margin={{ top: 6 }} gap={8} align="center" style={{ flexWrap: 'wrap' }}>
        {options.map((opt) => (
          <Button
            key={String(opt)}
            variant={opt === value ? 'primary' : 'secondary'}
            size="sm" dark={p.dark}
            onPress={() => { onSelect(opt); }}
            label={String(opt)}
            accessibilityLabel={`Set ${name} to ${String(opt)}`}
/>
        ))}
      </Row>
    </Box>
  );
}

/** Renders the palette color tokens for the current theme. */
export function ColorTokens({ p }: { p: GalleryPalette }): React.ReactElement {
  const palette = usePalette();
  const scheme = useEffectiveColorScheme();
  const seeds = useThemeSeeds();
  const seed = seeds[scheme];
  /** Seed Value. */
  const seedValue = (key: SeedColorKey): string =>
    key === 'background' ? seed.surface.background
      : key === 'foreground' ? seed.surface.foreground
        : seed[key];
  return (
    <Box>
      <Row margin={{ top: 16 }} align="center" justify="between">
        <Text color={p.sub} variant="caption" weight="medium">
          {`seed theme - derives the palette - ${scheme}`}
        </Text>
        <Button
          variant="secondary" size="sm" dark={p.dark}
          onPress={() => { resetOverrides(); }}
          label="Reset" accessibilityLabel="Reset theme seed to defaults"
/>
      </Row>
      <Box margin={{ top: 2 }}>
        {SEED_ROWS.map(([label, key]) => (
          <SeedSwatch key={label} name={label} seedKey={key} value={seedValue(key)} scheme={scheme} p={p}/>
        ))}
      </Box>

      {/* Derived-palette preview: the 4 seeds derive these read-only swatches. */}
      <Box margin={{ top: 20 }}>
        <Text color={p.sub} variant="caption" weight="medium">DERIVED</Text>
        <Row margin={{ top: 8 }} gap={8} align="center" style={{ flexWrap: 'wrap' }}>
          {([
            ['bg', palette.bg], ['border', palette.border], ['text', palette.text],
            ['sub', palette.sub], ['link', palette.link], ['inputBg', palette.inputBg],
          ] as readonly (readonly [string, string])[]).map(([k, c]) => (
            <Col key={k} align="center" gap={2}>
              <Box width={32} height={32} background={c} style={{ borderRadius: 8, borderWidth: 1, borderColor: p.border }}/>
              <Text size="3xs" color={p.sub}>{k}</Text>
            </Col>
          ))}
        </Row>
      </Box>

      <SeedChoice name="density" options={DENSITY_OPTS} value={seeds.density} onSelect={setSeedDensity} p={p}/>
      <SeedChoice name="radius" options={RADIUS_OPTS} value={seeds.radius} onSelect={setSeedRadius} p={p}/>
      <SeedChoice name="text-size" options={BASE_SIZE_OPTS} value={seeds.baseSize} onSelect={setSeedBaseSize} p={p}/>
    </Box>
  );
}
