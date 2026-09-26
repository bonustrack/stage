import { useState } from 'react';
import * as Line from '@central-icons-react-native/round-outlined-radius-1-stroke-2';
import * as Solid from '@central-icons-react-native/round-filled-radius-1-stroke-2';
import type { Story } from '../gallery/story';
import { BrandIcon, CENTRAL_ICON_ALIASES, Icon, type BrandIconProps, type HeroIconName } from '../src/react-native/icon';
import { Glyph, type CentralIcon, type IconStyle } from '../src/react-native/glyph';
import { Col, Row } from '../src/react-native/box';
import { Input } from '../src/react-native/input';
import { Text } from '../src/react-native/text';
import { Title } from '../src/react-native/title';
import { color, range, select, useDark } from './_controls';

export default { title: 'Icon' };

type CentralName = keyof typeof Line.centralIcons;

const STYLES = ['line', 'solid'] as const;
const NAMES = Object.keys(Line.centralIcons) as CentralName[];
const ALIAS_NAMES = Object.keys(CENTRAL_ICON_ALIASES) as HeroIconName[];
const SETS = { line: Line, solid: Solid } as unknown as Record<IconStyle, Record<CentralName, CentralIcon>>;
const NAME_OF = new Map<CentralIcon, CentralName>(NAMES.map((name) => [SETS.line[name], name]));
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

function matches(name: CentralName, query: string): boolean {
  if (query === '') return true;
  if (name.toLowerCase().includes(query)) return true;
  return (ALIASES_OF.get(name) ?? []).some((alias) => alias.toLowerCase().includes(query));
}

function byCategory(query: string): [string, CentralName[]][] {
  const groups = new Map<string, CentralName[]>();
  for (const name of NAMES) {
    if (!matches(name, query)) continue;
    const category = Line.centralIcons[name].category;
    groups.set(category, [...(groups.get(category) ?? []), name]);
  }
  return [...groups.entries()];
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
  const categories = byCategory(query.trim().toLowerCase());
  const count = categories.reduce((sum, [, names]) => sum + names.length, 0);
  return (
    <Col gap={24}>
      <Input dark={dark} value={query} onChangeText={setQuery} placeholder="Search icons" />
      <Text role="secondary">{`${count} of ${NAMES.length} icons, ${style}`}</Text>
      {count === 0 ? <Text role="muted">{`No icons match "${query.trim()}"`}</Text> : null}
      {categories.map(([category, names]) => (
        <Col key={category} gap={8}>
          <Title level={3}>{`${category} (${names.length})`}</Title>
          <Row gap={8} wrap>
            {names.map((name) => (
              <IconCell key={name} icon={SETS[style][name]} label={name} detail={ALIASES_OF.get(name)?.join(', ')} dark={dark} />
            ))}
          </Row>
        </Col>
      ))}
    </Col>
  );
}

interface ControlsArgs { name: CentralName; style: IconStyle; size: number; color?: string }

export const Controls: Story<ControlsArgs> = ({ name, style, size, color: tint }) => (
  <Glyph icon={SETS[style][name]} size={size} color={tint} dark={useDark()} />
);
Controls.args = { name: 'IconThumbtack', style: 'line', size: 32 };
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
