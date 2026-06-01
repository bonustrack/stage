/** Title story tab — live Title preview driven by a level control + text input,
 *  above the full levels/size-tokens gallery. Level state is typed as the kit's
 *  TitleLevel union; the preview renders Title at that level. */

import { useState } from 'react';
import { Box } from '../layout';
import { Title, type TitleLevel } from '@metro-labs/kit/title';
import { Segmented, TextField, PreviewStage, type ControlPalette } from './KitControls';
import { TitleSection } from './KitGallery.title';

const LEVELS: ReadonlyArray<TitleLevel> = [1, 2, 3];

export function KitTitleStory({ p }: { p: ControlPalette }): React.ReactElement {
  const { dark, head } = p;
  const [level, setLevel] = useState<TitleLevel>(1);
  const [text, setText] = useState<string>('The quick brown fox');

  return (
    <Box>
      <PreviewStage p={p}>
        <Title dark={dark} level={level} color={head}>{text || ' '}</Title>
      </PreviewStage>

      <Segmented label="Level" value={level} options={LEVELS}
        onChange={setLevel} labelOf={(l) => `Level ${l}`} p={p} />
      <TextField label="Text" value={text} onChange={setText} p={p}
        placeholder="The quick brown fox" />

      <Box mt={24}>
        <TitleSection dark={dark} head={head} />
      </Box>
    </Box>
  );
}
