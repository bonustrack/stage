/** Text section of the Kit gallery — every supported Text option, each labeled.
 *  From packages/kit/src/text.tsx:
 *    - variant: body · secondary · caption · mono
 *    - size token: sm (13) · md (15) · lg (17)   (numeric px also accepted)
 *    - weight: regular · medium · semibold        (mono ignores weight → Menlo)
 *  Renders one labeled example of each size for every variant, plus every
 *  weight, so nothing is omitted. */

import { Box } from '../layout';
import { Text, type TextVariant, type TextWeight, type TextSizeToken } from '@metro-labs/kit/text';

const VARIANTS: ReadonlyArray<TextVariant> = ['body', 'secondary', 'caption', 'mono'];
const SIZES: ReadonlyArray<{ token: TextSizeToken; px: number }> = [
  { token: 'sm', px: 13 },
  { token: 'md', px: 15 },
  { token: 'lg', px: 17 },
];
const WEIGHTS: ReadonlyArray<TextWeight> = ['regular', 'medium', 'semibold'];

const SAMPLE = 'The quick brown fox (0x1234…abcd)';

function VariantBlock({ variant, dark }: {
  variant: TextVariant; dark: boolean;
}): React.ReactElement {
  return (
    <Box style={{ marginTop: 12 }}>
      <Text dark={dark} variant="secondary" weight="semibold" size="sm">{variant}</Text>
      {SIZES.map(({ token, px }) => (
        <Text key={token} dark={dark} variant={variant} size={token} style={{ marginTop: 2 }}>
          {`size '${token}' · ${px}px — ${SAMPLE}`}
        </Text>
      ))}
    </Box>
  );
}

export function TextSection({ dark }: { dark: boolean }): React.ReactElement {
  return (
    <Box>
      {VARIANTS.map((variant) => (
        <VariantBlock key={variant} variant={variant} dark={dark} />
      ))}
      <Box style={{ marginTop: 12 }}>
        <Text dark={dark} variant="secondary" weight="semibold" size="sm">weights (variant body · md)</Text>
        {WEIGHTS.map((weight) => (
          <Text key={weight} dark={dark} variant="body" weight={weight} size="md" style={{ marginTop: 2 }}>
            {`weight '${weight}' — The quick brown fox`}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
