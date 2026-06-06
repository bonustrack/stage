/** ListView story tab - thin wrapper: local state seeded from LIST_VIEW_SPEC, a
 *  live ListView + ListViewItem preview, and the generic ControlsForm driving
 *  rows / align / gap / limit / status / pressable. Row bodies are composed from
 *  Icon + Text (as ChatKit's ListViewItem expects - it abstracts only the
 *  wrapper, not the content). No bespoke form code - data-driven from KitSpec. */

import { useState } from 'react';
import { Box } from '../layout';
import { ListView, ListViewItem } from '@metro-labs/kit/list-view';
import { Icon } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';
import { PreviewStage, type ControlPalette } from './KitControls';
import { ControlsForm } from './ControlsForm';
import { LIST_VIEW_SPEC, defaultsOf, type ListViewStoryState } from './KitSpec';

const ROW_LABELS = ['Display', 'Messenger', 'Notifications', 'Security', 'About'];

export function KitListViewStory({ p }: { p: ControlPalette }): React.ReactElement {
  const { dark, head, sub } = p;
  const [s, setS] = useState<ListViewStoryState>(() => defaultsOf(LIST_VIEW_SPEC));

  const rows = ROW_LABELS.slice(0, s.rows);

  return (
    <Box>
      <PreviewStage p={p}>
        <Box style={{ width: '100%' }}>
          <ListView
            dark={dark}
            limit={s.limit || undefined}
            status={s.statusText ? { text: s.statusText } : undefined}
          >
            {rows.map((label) => (
              <ListViewItem
                key={label}
                dark={dark}
                gap={s.gap}
                align={s.align}
                onPress={s.pressable ? () => {} : undefined}
              >
                <Icon name="cog" size={22} color={head} />
                <Box style={{ flex: 1 }}>
                  <Text dark={dark} color={head} weight="medium" size={18}>{label}</Text>
                </Box>
                <Icon name="chevronRight" size={18} color={sub} />
              </ListViewItem>
            ))}
          </ListView>
        </Box>
      </PreviewStage>

      <ControlsForm spec={LIST_VIEW_SPEC} value={s} onChange={setS} p={p} />
    </Box>
  );
}
