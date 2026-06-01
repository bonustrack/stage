/** Kit | About underline tabs for the System screen — mirrors the Wallet page's
 *  Tokens|NFTs WalletTabs style (Snapshot-treasury underline). */

import { Pressable } from 'react-native';
import { Row } from '../layout';
import { Text } from '@metro-labs/kit/text';

export type SystemTab = 'kit' | 'about';

export function SystemTabs({ tab, setTab, head, sub, border }: {
  tab: SystemTab; setTab: (t: SystemTab) => void; head: string; sub: string; border: string;
}): React.ReactElement {
  return (
    <Row justify="start" gap={24} mx={16} mt={22} mb={6}
      style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      {(['kit', 'about'] as const).map(t => {
        const active = tab === t;
        return (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              paddingVertical: 10,
              marginBottom: -1,
              borderBottomWidth: 2,
              borderBottomColor: active ? head : 'transparent',
            }}
          >
            <Text style={{ color: active ? head : sub, fontSize: 18, fontFamily: 'Calibre-Semibold' }}>
              {t === 'kit' ? 'Kit' : 'About'}
            </Text>
          </Pressable>
        );
      })}
    </Row>
  );
}
