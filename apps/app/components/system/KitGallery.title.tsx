/** Title section of the Kit gallery — every supported Title sizing option,
 *  each labeled. Title sizing comes from packages/kit/src/title.tsx:
 *    - level: 1 (28) · 2 (22) · 3 (18)
 *    - size token alias: lg→1 · md→2 · sm→3
 *  Both spellings are shown so nothing is omitted. */

import { Box } from '../layout';
import { Title, type TitleLevel, type TitleSizeToken } from '@metro-labs/kit/title';
import { Text } from '@metro-labs/kit/text';

const LEVELS: ReadonlyArray<{ level: TitleLevel; note: string }> = [
  { level: 1, note: 'level 1 · 28px' },
  { level: 2, note: 'level 2 · 22px' },
  { level: 3, note: 'level 3 · 18px' },
];

const SIZE_TOKENS: ReadonlyArray<{ size: TitleSizeToken; note: string }> = [
  { size: 'lg', note: "size 'lg' · alias of level 1 · 28px" },
  { size: 'md', note: "size 'md' · alias of level 2 · 22px" },
  { size: 'sm', note: "size 'sm' · alias of level 3 · 18px" },
];

export function TitleSection({ dark, head }: {
  dark: boolean; head: string;
}): React.ReactElement {
  return (
    <Box>
      {LEVELS.map(({ level, note }) => (
        <Box key={`lvl-${level}`} style={{ marginTop: 10 }}>
          <Text dark={dark} variant="secondary" weight="medium" size="sm">{note}</Text>
          <Title dark={dark} level={level} color={head}>The quick brown fox</Title>
        </Box>
      ))}
      {SIZE_TOKENS.map(({ size, note }) => (
        <Box key={`size-${size}`} style={{ marginTop: 10 }}>
          <Text dark={dark} variant="secondary" weight="medium" size="sm">{note}</Text>
          <Title dark={dark} size={size} color={head}>The quick brown fox</Title>
        </Box>
      ))}
    </Box>
  );
}
