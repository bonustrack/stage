/** IconPicker — a filterable picker over EVERY kit icon name (HERO_ICON_PATHS
 *  keys). A text filter narrows the wrapped grid of tappable glyph chips; the
 *  selected name gets a head-coloured border. Used by ControlsForm for any
 *  `icon`-kind control (Button icon, Icon name). Strongly typed: value/onChange
 *  are HeroIconName, no `any`. */

import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { Box, Row } from '../layout';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { HERO_ICON_PATHS } from '@metro-labs/kit/icons';
import { Text } from '@metro-labs/kit/text';
import { TextField, type ControlPalette } from './KitControls';

const ICON_NAMES = Object.keys(HERO_ICON_PATHS) as HeroIconName[];

export function IconPicker({ label, value, onChange, p }: {
  label: string; value: HeroIconName; onChange: (v: HeroIconName) => void;
  p: ControlPalette;
}): React.ReactElement {
  const [query, setQuery] = useState<string>('');
  const matches = useMemo<HeroIconName[]>(() => {
    const q = query.trim().toLowerCase();
    return q ? ICON_NAMES.filter((n) => n.toLowerCase().includes(q)) : ICON_NAMES;
  }, [query]);

  return (
    <Box mt={14}>
      <TextField label={label} value={query} onChange={setQuery} p={p}
        placeholder="Filter icons by name…" />
      <Text dark={p.dark} color={p.sub} variant="caption" weight="medium"
        style={{ marginTop: 10 }}>
        {`${matches.length} of ${ICON_NAMES.length} · selected: ${value}`}
      </Text>
      <Row gap={8} mt={8} style={{ flexWrap: 'wrap' }}>
        {matches.map((name) => {
          const active = name === value;
          return (
            <Pressable
              key={name}
              onPress={() => onChange(name)}
              style={{
                width: 44, height: 44, borderRadius: 10, borderWidth: 1,
                alignItems: 'center', justifyContent: 'center',
                borderColor: active ? p.head : p.border,
                backgroundColor: active ? p.rowBg : 'transparent',
              }}
            >
              <Icon name={name} size={22} color={active ? p.head : p.sub} />
            </Pressable>
          );
        })}
      </Row>
    </Box>
  );
}
