import { useState, type ReactNode } from 'react';
import type { Story } from '../gallery/story';
import { CENTRAL_ICONS } from '../src/central-icons.data';
import { A2UI_ICONS, A2UI_ICON_NAMES } from '../src/icons.a2ui';
import { BRAND_ICON_NAMES } from '../src/brand-icons.data';
import { CENTRAL_ICON_ALIASES, Icon, type HeroIconName, type IconProps } from '../src/react-native/icon';
import { Glyph, type CentralIcon, type IconStyle } from '../src/react-native/glyph';
import { Column } from '../src/react-native/column';
import { Row } from '../src/react-native/row';
import { SEARCH_INPUT_PROPS, TextField } from '../src/react-native/text-field';
import { Text } from '../src/react-native/text';
import { color, range, select, useDark } from './_controls';

export default { title: 'Icon' };

type CentralName = keyof typeof CENTRAL_ICONS;

const ICONS: Record<CentralName, { line: CentralIcon; solid?: CentralIcon }> = CENTRAL_ICONS;
const STYLES = ['line', 'solid'] as const;
const NAMES = Object.keys(ICONS) as CentralName[];
const ALIAS_NAMES = Object.keys(CENTRAL_ICON_ALIASES) as HeroIconName[];
const NAME_OF = new Map<CentralIcon, CentralName>(NAMES.map((name) => [ICONS[name].line, name]));

function aliasesByName(): Map<CentralName, string[]> {
  const out = new Map<CentralName, string[]>([['IconThumbtack', ['pin']]]);
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
  return style === 'solid' ? (ICONS[name].solid ?? ICONS[name].line) : ICONS[name].line;
}

function matches(name: CentralName, query: string): boolean {
  if (query === '') return true;
  if (name.toLowerCase().includes(query)) return true;
  return (ALIASES_OF.get(name) ?? []).some((alias) => alias.toLowerCase().includes(query));
}

function Cell({ label, detail, children }: { label: string; detail?: string; children: ReactNode }): React.ReactElement {
  return (
    <Column width={136} align="center" gap={4} padding={{ y: 8 }}>
      {children}
      <Text color="secondary" truncate size="3xs">
        {label}
      </Text>
      {detail === undefined ? null : (
        <Text color="muted" truncate size="3xs">
          {detail}
        </Text>
      )}
    </Column>
  );
}

function Catalogue({ style }: { style: IconStyle }): React.ReactElement {
  const dark = useDark();
  const [query, setQuery] = useState('');
  const available = namesIn(style);
  const names = available.filter((name) => matches(name, query.trim().toLowerCase()));
  return (
    <Column gap={24}>
      <TextField dark={dark} value={query} onChangeText={setQuery} placeholder="Search icons" inputProps={SEARCH_INPUT_PROPS} />
      <Text size="xs" color="secondary">{`${names.length} of ${available.length} icons, ${style}`}</Text>
      {names.length === 0 ? <Text size="xs" color="muted">{`No icons match "${query.trim()}"`}</Text> : null}
      <Row gap={8} wrap>
        {names.map((name) => (
          <Cell key={name} label={name} detail={ALIASES_OF.get(name)?.join(', ')}>
            <Glyph icon={glyph(name, style)} size={24} dark={dark} />
          </Cell>
        ))}
      </Row>
    </Column>
  );
}

interface GlyphArgs {
  name: CentralName;
  style: IconStyle;
  size: number;
  color?: string;
}

export const Controls: Story<IconProps> = (args) => <Icon dark={useDark()} {...args} />;
Controls.args = { name: 'send', size: 32, variant: 'line' };
Controls.argTypes = {
  name: select([...ALIAS_NAMES, ...A2UI_ICON_NAMES, ...BRAND_ICON_NAMES]),
  size: range(12, 96, 4),
  color,
  variant: select(['line', 'solid']),
};

export const CentralGlyph: Story<GlyphArgs> = ({ name, style, size, color: tint }) => (
  <Glyph icon={glyph(name, style)} size={size} color={tint} dark={useDark()} />
);
CentralGlyph.args = { name: 'IconPaperPlane', style: 'line', size: 32 };
CentralGlyph.argTypes = { name: select(NAMES), style: select(STYLES), size: range(12, 96, 4), color };

export const All: Story<{ style: IconStyle }> = ({ style }) => <Catalogue style={style} />;
All.args = { style: 'line' };
All.argTypes = { style: select(STYLES) };

function NamedCell({
  name,
  detail,
  variant,
}: {
  name: IconProps['name'] & string;
  detail: string;
  variant: IconStyle;
}): React.ReactElement {
  return (
    <Cell label={name} detail={detail}>
      <Icon name={name} variant={variant} size={24} dark={useDark()} />
    </Cell>
  );
}

export const Aliases: Story<{ style: IconStyle }> = ({ style }) => (
  <Row gap={8} wrap>
    {ALIAS_NAMES.map((alias) => (
      <NamedCell key={alias} name={alias} variant={style} detail={NAME_OF.get(CENTRAL_ICON_ALIASES[alias].line) ?? ''} />
    ))}
  </Row>
);
Aliases.args = { style: 'line' };
Aliases.argTypes = { style: select(STYLES) };

export const A2ui: Story<{ style: IconStyle }> = ({ style }) => (
  <Row gap={8} wrap>
    {A2UI_ICON_NAMES.map((name) => {
      const target = A2UI_ICONS[name];
      return <NamedCell key={name} name={name} variant={style} detail={typeof target === 'string' ? target : target.extra} />;
    })}
  </Row>
);
A2ui.args = { style: 'line' };
A2ui.argTypes = { style: select(STYLES) };

export const Brand: Story<{ size: number; color?: string }> = ({ size, color: tint }) => (
  <Row gap={16} wrap>
    {BRAND_ICON_NAMES.map((name) => (
      <Icon key={name} name={name} size={size} color={tint} dark={useDark()} />
    ))}
  </Row>
);
Brand.args = { size: 32 };
Brand.argTypes = { size: range(12, 96, 4), color };
