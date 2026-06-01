/** KitTabs — the Storybook-style explorer shell for the Kit page. An underline
 *  tab bar (Wallet-page style: bottom-border row, active item gets a 2px head-
 *  coloured underline) with one tab per kit component: Title · Text · Button ·
 *  Icons. Selecting a tab renders ONLY that component's story (live controls +
 *  preview + full variant grid). Tab state is local useState. */

import { useState } from 'react';
import { Pressable } from 'react-native';
import { Box, Row } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { type ControlPalette } from './KitControls';
import { KitTitleStory } from './KitTitle.story';
import { KitTextStory } from './KitText.story';
import { KitButtonStory } from './KitButton.story';
import { KitIconsStory } from './KitIcons.story';
import { KitColorsStory } from './KitColors.story';

const TABS = ['Title', 'Text', 'Button', 'Icons', 'Colors'] as const;
type KitTab = (typeof TABS)[number];

function TabBar({ tab, setTab, p }: {
  tab: KitTab; setTab: (t: KitTab) => void; p: ControlPalette;
}): React.ReactElement {
  return (
    <Row justify="start" gap={24} mt={8}
      style={{ borderBottomWidth: 1, borderBottomColor: p.border }}>
      {TABS.map((t) => {
        const active = tab === t;
        return (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              paddingVertical: 10, marginBottom: -1,
              borderBottomWidth: 2, borderBottomColor: active ? p.head : 'transparent',
            }}
          >
            <Text style={{ color: active ? p.head : p.sub, fontSize: 18, fontFamily: 'Calibre-Semibold' }}>
              {t}
            </Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

export function KitTabs({ p }: { p: ControlPalette }): React.ReactElement {
  const [tab, setTab] = useState<KitTab>('Title');
  return (
    <Box>
      <TabBar tab={tab} setTab={setTab} p={p} />
      <Box mt={4}>
        {tab === 'Title' ? <KitTitleStory p={p} /> : null}
        {tab === 'Text' ? <KitTextStory p={p} /> : null}
        {tab === 'Button' ? <KitButtonStory p={p} /> : null}
        {tab === 'Icons' ? <KitIconsStory p={p} /> : null}
        {tab === 'Colors' ? <KitColorsStory p={p} /> : null}
      </Box>
    </Box>
  );
}
