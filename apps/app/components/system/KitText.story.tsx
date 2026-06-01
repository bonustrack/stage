/** Text story tab — live Text preview driven by variant + size + weight controls
 *  and a text input, above the full variants×sizes×weights gallery. All control
 *  state is typed against the kit's TextVariant / TextSizeToken / TextWeight
 *  unions. Note: the `mono` variant ignores weight (renders Menlo) — that's the
 *  kit's behaviour and is faithfully reflected here. */

import { useState } from 'react';
import { Box } from '../layout';
import { Text, type TextVariant, type TextWeight, type TextSizeToken } from '@metro-labs/kit/text';
import { Segmented, TextField, PreviewStage, type ControlPalette } from './KitControls';
import { TextSection } from './KitGallery.text';

const VARIANTS: ReadonlyArray<TextVariant> = ['body', 'secondary', 'caption', 'mono'];
const SIZES: ReadonlyArray<TextSizeToken> = ['sm', 'md', 'lg'];
const WEIGHTS: ReadonlyArray<TextWeight> = ['regular', 'medium', 'semibold'];

export function KitTextStory({ p }: { p: ControlPalette }): React.ReactElement {
  const { dark } = p;
  const [variant, setVariant] = useState<TextVariant>('body');
  const [size, setSize] = useState<TextSizeToken>('md');
  const [weight, setWeight] = useState<TextWeight>('regular');
  const [text, setText] = useState<string>('The quick brown fox (0x1234…abcd)');

  return (
    <Box>
      <PreviewStage p={p}>
        <Text dark={dark} variant={variant} size={size} weight={weight}>
          {text || ' '}
        </Text>
      </PreviewStage>

      <Segmented label="Variant" value={variant} options={VARIANTS}
        onChange={setVariant} p={p} />
      <Segmented label="Size" value={size} options={SIZES} onChange={setSize} p={p} />
      <Segmented label="Weight" value={weight} options={WEIGHTS} onChange={setWeight} p={p} />
      <TextField label="Text" value={text} onChange={setText} p={p} />

      <Box mt={24}>
        <TextSection dark={dark} />
      </Box>
    </Box>
  );
}
