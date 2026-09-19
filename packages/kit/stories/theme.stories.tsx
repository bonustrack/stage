import type { Story } from '../gallery/story';
import { KitThemeProvider } from '../src/react-native/theme-context';
import { DEFAULT_SEED, derivePalette, type AccentLevel, type GrayscaleShade, type GrayscaleTint } from '../src/theme-derive';
import { kitTheme, type BaseSize, type Density, type RadiusName } from '../src/tokens';
import { Button } from '../src/react-native/button';
import { Input } from '../src/react-native/input';
import { Badge } from '../src/react-native/badge';
import { Card } from '../src/react-native/card';
import { Col, Row } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { color, range, select, useDark } from './_controls';

export default { title: 'Theme' };

interface ThemeArgs {
  accentPrimary?: string; accentLevel: AccentLevel; grayscaleHue?: number; grayscaleTint?: GrayscaleTint; grayscaleShade?: GrayscaleShade;
  surfaceBackground?: string; surfaceForeground?: string; radius: RadiusName; density: Density; baseSize: BaseSize;
}

export const Controls: Story<ThemeArgs> = (args) => {
  const dark = useDark();
  const scheme = dark ? 'dark' : 'light';
  const seed = DEFAULT_SEED[scheme];
  const palette = derivePalette({
    accent: { primary: args.accentPrimary ?? seed.accent.primary, level: args.accentLevel },
    grayscale: { hue: args.grayscaleHue ?? seed.grayscale.hue, tint: args.grayscaleTint ?? seed.grayscale.tint, shade: args.grayscaleShade ?? seed.grayscale.shade },
    surface: { background: args.surfaceBackground ?? seed.surface.background, foreground: args.surfaceForeground ?? seed.surface.foreground },
  }, scheme);
  const theme = kitTheme(scheme, { radius: args.radius, density: args.density, baseSize: args.baseSize, accentLevel: args.accentLevel });
  return (
    <KitThemeProvider value={palette} scheme={scheme}>
      <Col gap={16} padding={24} background={palette.bg} radius="lg">
        <Row gap={8} wrap>
          <Button dark={dark} label="Primary" radius={theme.radius.px} />
          <Button dark={dark} label="Soft" variant="soft" radius={theme.radius.px} />
          <Button dark={dark} label="Outline" variant="outline" radius={theme.radius.px} />
          <Badge dark={dark} label="Badge" color="info" />
        </Row>
        <Input dark={dark} placeholder="Input on the derived palette" />
        <Card dark={dark}><Text color={palette.text}>Card on the derived surface. Sub text: <Text color={palette.sub}>{palette.sub}</Text></Text></Card>
        <Row gap={8} wrap>
          {(Object.keys(palette) as (keyof typeof palette)[]).map((name) => (
            <Col key={name} align="center" gap={4}>
              <Col size={40} radius="md" background={palette[name]} border={{ top: { width: 1, color: palette.border }, right: { width: 1, color: palette.border }, bottom: { width: 1, color: palette.border }, left: { width: 1, color: palette.border } }} />
              <Text size="3xs" color={palette.sub}>{name}</Text>
            </Col>
          ))}
        </Row>
        <Text size="xs" variant="mono" color={palette.sub}>{JSON.stringify({ radius: theme.radius, density: theme.density, typography: theme.typography })}</Text>
      </Col>
    </KitThemeProvider>
  );
};
Controls.args = { accentLevel: 3, radius: 'pill', density: 'normal', baseSize: 15 };
Controls.argTypes = {
  accentPrimary: color, accentLevel: select([0, 1, 2, 3]), grayscaleHue: range(0, 360), grayscaleTint: select([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
  grayscaleShade: select([-4, -3, -2, -1, 0, 1, 2, 3, 4]), surfaceBackground: color, surfaceForeground: color,
  radius: select(['pill', 'round', 'soft', 'sharp']), density: select(['compact', 'normal', 'spacious']), baseSize: select([14, 15, 16, 17, 18]),
};
