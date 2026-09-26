import { useState } from 'react';
import type { Story } from '../gallery/story';
import { CENTRAL_ICONS } from '../src/central-icons.data';
import { BrandIcon, CENTRAL_ICON_ALIASES, Icon, type BrandIconProps, type HeroIconName } from '../src/react-native/icon';
import { Glyph, type CentralIcon, type IconStyle } from '../src/react-native/glyph';
import { Col, Row } from '../src/react-native/box';
import { Input } from '../src/react-native/input';
import { Text } from '../src/react-native/text';
import { color, range, select, useDark } from './_controls';

export default { title: 'Icon' };

type CentralName = keyof typeof CENTRAL_ICONS;

const ICONS: Record<CentralName, { line: CentralIcon; solid?: CentralIcon }> = CENTRAL_ICONS;
const STYLES = ['line', 'solid'] as const;
const NAMES = Object.keys(ICONS) as CentralName[];
const ALIAS_NAMES = Object.keys(CENTRAL_ICON_ALIASES) as HeroIconName[];
const NAME_OF = new Map<CentralIcon, CentralName>(NAMES.map((name) => [ICONS[name].line, name]));
const BRAND_NAMES = ['brandX', 'brandGithub', 'pin', 'brandApple', 'brandAndroid', 'brandWindows', 'brandLinux'] as const;

function aliasesByName(): Map<CentralName, HeroIconName[]> {
  const out = new Map<CentralName, HeroIconName[]>();
  for (const alias of ALIAS_NAMES) {
    const name = NAME_OF.get(CENTRAL_ICON_ALIASES[alias].line);
    if (name !== undefined) out.set(name, [...(out.get(name) ?? []), alias]);
  }
  return out;
}

const ALIASES_OF = aliasesByName();

function namesIn(style: IconStyle): CentralName[] {
  return style === 'solid' ? NAMES.filter((name) => ICONS[name].solid !== undefined) : NAMES;
}

function glyph(name: CentralName, style: IconStyle): CentralIcon {
  return style === 'solid' ? ICONS[name].solid ?? ICONS[name].line : ICONS[name].line;
}

function matches(name: CentralName, query: string): boolean {
  if (query === '') return true;
  if (name.toLowerCase().includes(query)) return true;
  return (ALIASES_OF.get(name) ?? []).some((alias) => alias.toLowerCase().includes(query));
}

function IconCell({ icon, label, detail, dark }: { icon: CentralIcon; label: string; detail?: string; dark: boolean }): React.ReactElement {
  return (
    <Col width={136} align="center" gap={4} padding={{ y: 8 }}>
      <Glyph icon={icon} size={24} dark={dark} />
      <Text size="3xs" role="secondary" truncate>{label}</Text>
      {detail === undefined ? null : <Text size="3xs" role="muted" truncate>{detail}</Text>}
    </Col>
  );
}

function Catalogue({ style }: { style: IconStyle }): React.ReactElement {
  const dark = useDark();
  const [query, setQuery] = useState('');
  const available = namesIn(style);
  const names = available.filter((name) => matches(name, query.trim().toLowerCase()));
  return (
    <Col gap={24}>
      <Input dark={dark} value={query} onChangeText={setQuery} placeholder="Search icons" />
      <Text role="secondary">{`${names.length} of ${available.length} icons, ${style}`}</Text>
      {names.length === 0 ? <Text role="muted">{`No icons match "${query.trim()}"`}</Text> : null}
      <Row gap={8} wrap>
        {names.map((name) => (
          <IconCell key={name} icon={glyph(name, style)} label={name} detail={ALIASES_OF.get(name)?.join(', ')} dark={dark} />
        ))}
      </Row>
    </Col>
  );
}

interface ControlsArgs { name: CentralName; style: IconStyle; size: number; color?: string }

export const Controls: Story<ControlsArgs> = ({ name, style, size, color: tint }) => (
  <Glyph icon={glyph(name, style)} size={size} color={tint} dark={useDark()} />
);
Controls.args = { name: 'IconPaperPlane', style: 'line', size: 32 };
Controls.argTypes = { name: select(NAMES), style: select(STYLES), size: range(12, 96, 4), color };

export const All: Story<{ style: IconStyle }> = ({ style }) => <Catalogue style={style} />;
All.args = { style: 'line' };
All.argTypes = { style: select(STYLES) };

export const Aliases: Story<{ style: IconStyle }> = ({ style }) => {
  const dark = useDark();
  return (
    <Row gap={8} wrap>
      {ALIAS_NAMES.map((alias) => (
        <Col key={alias} width={136} align="center" gap={4} padding={{ y: 8 }}>
          <Icon name={alias} variant={style} size={24} dark={dark} />
          <Text size="3xs" role="secondary" truncate>{alias}</Text>
          <Text size="3xs" role="muted" truncate>{NAME_OF.get(CENTRAL_ICON_ALIASES[alias].line) ?? ''}</Text>
        </Col>
      ))}
    </Row>
  );
};
Aliases.args = { style: 'line' };
Aliases.argTypes = { style: select(STYLES) };

export const Brand: Story<BrandIconProps> = (args) => <BrandIcon dark={useDark()} {...args} />;
Brand.args = { name: 'brandGithub', size: 32 };
Brand.argTypes = { name: select(BRAND_NAMES), size: range(12, 96, 4), color };
