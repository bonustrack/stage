
import { Pressable } from '@stage-labs/kit/react-native/pressable';

import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { Title } from '@stage-labs/kit/react-native/title';
import { Row, Col } from '../components/layout';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { AccountsManager } from '../components/AccountsManager';

export default function Accounts(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <Col surface="surface" flex={1}>
      {}
      <Row surface="toolbar" padding={{ x: 12, top: 8 + insets.top, bottom: 10 }} align="center" gap={8} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
        <Pressable onPress={() => { router.back(); }} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={fg}/>
        </Pressable>
        <Title size="sm" color={head}>
          Accounts
        </Title>
      </Row>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}>
        <AccountsManager dark={dark} flat onSwitched={() => { router.back(); }}/>
      </ScrollView>
    </Col>
  );
}
