
import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Input } from '@stage-labs/kit/react-native/input';
import { Box, Row, Col } from '../layout';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import {
  usePalette, useEffectiveColorScheme, useThemeSeeds, seedColorHex,
  setSeedColor, setSeedDensity, setSeedRadius, setSeedBaseSize, resetOverrides,
  setAccentLevel, setGrayscaleTint, setGrayscaleShade,
  type SeedColorKey,
} from '../../lib/theme';
import type { GalleryPalette } from './galleryPalette';
import { AppModal } from '../AppModal';
import { ColorPicker } from '@stage-labs/kit/react-native/color-picker';
import { isHex } from '../../lib/colorOverrides';
import type { AccentLevel, GrayscaleShade, GrayscaleTint } from '@stage-labs/kit/theme-derive';
import {
  fontSize, type Density, type RadiusName, type BaseSize,
} from '@stage-labs/kit/tokens';

const SEED_ROWS: readonly (readonly [label: string, key: SeedColorKey])[] = [
  ['surface-background', 'background'],
  ['surface-foreground', 'foreground'],
  ['accent-primary', 'accent'],
  ['grayscale', 'grayscale'],
];

const DENSITY_OPTS: readonly Density[] = ['compact', 'normal', 'spacious'];
const RADIUS_OPTS: readonly RadiusName[] = ['pill', 'round', 'soft', 'sharp'];
const BASE_SIZE_OPTS: readonly BaseSize[] = [14, 15, 16, 17, 18];
const ACCENT_LEVEL_OPTS: readonly AccentLevel[] = [0, 1, 2, 3];
const TINT_OPTS: readonly GrayscaleTint[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const SHADE_OPTS: readonly GrayscaleShade[] = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

function SeedSwatch({ name, seedKey, value, scheme, p }: {
  name: string; seedKey: SeedColorKey; value: string;
  scheme: 'light' | 'dark'; p: GalleryPalette;
}): React.ReactElement {
  const [draft, setDraft] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const shown = draft ?? value;
  const invalid = draft != null && !isHex(draft);
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
        <ColorPicker
          value={pending ?? value}
          mode="hsv"
          headColor={p.head}
          subColor={p.sub}
          borderColor={p.border}
          rowBg={p.rowBg}
          dark={p.dark}
          onChange={setPending}
        />
        <Row margin={{ top: 20 }} gap={12} align="center">
          <Button color="secondary" variant="solid" dark={p.dark} onPress={closePicker} label="Cancel" style={{ flex: 1 }}/>
          <Button
            dark={p.dark}
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
            color={opt === value ? 'primary' : 'secondary'} variant="solid"
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

export function ColorTokens({ p }: { p: GalleryPalette }): React.ReactElement {
  const palette = usePalette();
  const scheme = useEffectiveColorScheme();
  const seeds = useThemeSeeds();
  const seed = seeds[scheme];
  return (
    <Box>
      <Row margin={{ top: 16 }} align="center" justify="between">
        <Text color={p.sub} variant="caption" weight="medium">
          {`seed theme - derives the palette - ${scheme}`}
        </Text>
        <Button
          color="secondary" variant="solid" size="sm" dark={p.dark}
          onPress={() => { resetOverrides(); }}
          label="Reset" accessibilityLabel="Reset theme seed to defaults"
/>
      </Row>
      <Box margin={{ top: 2 }}>
        {SEED_ROWS.map(([label, key]) => (
          <SeedSwatch
            key={label} name={label} seedKey={key}
            value={seedColorHex(seeds, scheme, key)} scheme={scheme} p={p}
          />
        ))}
      </Box>

      <SeedChoice
        name="accent-level" options={ACCENT_LEVEL_OPTS} value={seed.accent.level}
        onSelect={(v) => { setAccentLevel(scheme, v); }} p={p}
      />
      <SeedChoice
        name="grayscale-tint" options={TINT_OPTS} value={seed.grayscale.tint}
        onSelect={(v) => { setGrayscaleTint(scheme, v); }} p={p}
      />
      <SeedChoice
        name="grayscale-shade" options={SHADE_OPTS} value={seed.grayscale.shade ?? 0}
        onSelect={(v) => { setGrayscaleShade(scheme, v); }} p={p}
      />

      {}
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
