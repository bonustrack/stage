/** Kit page — a live gallery of @metro-labs/kit components at every supported
 *  size/variant. Title (levels 1/2/3), Text (variants × weights × sizes), and
 *  Button (every SIZE × variant in 3 forms: text, text+icon, icon-only pill),
 *  plus an app-wide theme switcher. Section headers use the kit Title/Text. */

import { Box } from '../layout';
import { Title, type TitleLevel } from '@metro-labs/kit/title';
import { Text, type TextWeight } from '@metro-labs/kit/text';
import { ThemeSwitcher } from './ThemeSwitcher';
import { BUTTON_VARIANTS, ButtonVariantBlock } from './KitGallery.buttons';

const TITLE_LEVELS: ReadonlyArray<{ level: TitleLevel; note: string }> = [
  { level: 1, note: 'level 1 · 28' },
  { level: 2, note: 'level 2 · 22' },
  { level: 3, note: 'level 3 · 18' },
];

const TEXT_WEIGHTS: ReadonlyArray<TextWeight> = ['medium', 'semibold'];

function SectionHeader({ title, dark, head, sub }: {
  title: string; dark: boolean; head: string; sub: string;
}): React.ReactElement {
  return (
    <Box style={{ marginTop: 26, marginBottom: 2 }}>
      <Title dark={dark} level={2} color={head}>{title}</Title>
      <Text dark={dark} color={sub} variant="caption" weight="medium">
        @metro-labs/kit
      </Text>
    </Box>
  );
}

export function KitGallery({ dark, head, sub, border, rowBg }: {
  dark: boolean; head: string; sub: string; border: string; rowBg: string;
}): React.ReactElement {
  return (
    <Box style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
      <ThemeSwitcher dark={dark} head={head} sub={sub} border={border} rowBg={rowBg} />

      {/* Title */}
      <SectionHeader title="Title" dark={dark} head={head} sub={sub} />
      {TITLE_LEVELS.map(({ level, note }) => (
        <Box key={level} style={{ marginTop: 10 }}>
          <Text dark={dark} variant="secondary" weight="medium" size="sm">{note}</Text>
          <Title dark={dark} level={level} color={head}>The quick brown fox</Title>
        </Box>
      ))}

      {/* Text */}
      <SectionHeader title="Text" dark={dark} head={head} sub={sub} />
      {(['body', 'secondary', 'caption', 'mono'] as const).map((variant) => (
        <Box key={variant} style={{ marginTop: 10 }}>
          <Text dark={dark} variant="secondary" weight="medium" size="sm">{variant}</Text>
          <Box style={{ marginTop: 2 }}>
            {(['sm', 'md', 'lg'] as const).map((size) => (
              <Text key={size} dark={dark} variant={variant} size={size} style={{ marginTop: 2 }}>
                {size} — The quick brown fox jumps (0x1234…abcd)
              </Text>
            ))}
          </Box>
          {variant === 'body' ? (
            <Box style={{ marginTop: 4 }}>
              {TEXT_WEIGHTS.map((weight) => (
                <Text key={weight} dark={dark} variant="body" weight={weight} size="md" style={{ marginTop: 2 }}>
                  weight {weight} — The quick brown fox
                </Text>
              ))}
            </Box>
          ) : null}
        </Box>
      ))}

      {/* Button */}
      <SectionHeader title="Button" dark={dark} head={head} sub={sub} />
      <Text dark={dark} color={sub} variant="caption" weight="medium" style={{ marginTop: 2 }}>
        Each size (sm/md/lg) in 3 forms: text · text+icon · icon-only pill.
      </Text>
      {BUTTON_VARIANTS.map((variant) => (
        <ButtonVariantBlock key={variant} variant={variant} dark={dark} sub={sub} />
      ))}
    </Box>
  );
}
