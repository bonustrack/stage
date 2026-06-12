/** Settings → Username - claim a `<name>.stage.eth` username bound to the active
 *  account. Availability checks debounce against the gateway; claiming signs the
 *  shared claim message (local key in-process, WalletConnect via the wallet) and
 *  registers it. Once claimed, the name shows everywhere the address is rendered
 *  (peerProfiles prefers it over ENS). Logic lives in ./useUsernameClaim. */

import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { Card } from '@metro-labs/kit/card';
import { Input } from '@metro-labs/kit/input';
import { Button } from '@metro-labs/kit/button';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from '../system/SystemHeader';
import { useUsernameClaim } from './useUsernameClaim';

export function UsernameSettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const insets = useSafeAreaInsets();
  const c = useUsernameClaim();

  const hintColor =
    c.status === 'free' ? head
      : c.status === 'taken' || c.status === 'invalid' ? '#d9534f'
        : fg;

  return (
    <Col surface="surface" flex={1}>
      <SystemHeader title="Username" dark={dark} fg={fg} head={head} border={border}/>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 + insets.bottom }}
>
        {c.current ? (
          <Box margin={{ x: 16, top: 20 }}>
            <Text size="xs" color={fg} style={{ paddingBottom: 8 }}>YOUR USERNAME</Text>
            <Card dark={dark} background={border} padding={16}>
              <Text size="xl" color={head} weight="semibold">{c.current}</Text>
            </Card>
          </Box>
        ) : null}

        <Text size="xs" color={fg} style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
          {c.current ? 'CHANGE USERNAME' : 'CLAIM A USERNAME'}
        </Text>
        <Box margin={{ x: 16 }}>
          <Card dark={dark} background={border} padding={14}>
            <Row align="center" gap={6}>
              <Input
                value={c.input}
                onChangeText={c.setInput}
                placeholder="yourname"
                placeholderTextColor={fg}
                inputProps={{ autoCapitalize: 'none', autoCorrect: false, returnKeyType: 'done' }}
                style={{ flex: 1, color: head, fontFamily: 'Calibre-Medium', padding: 0,
                  backgroundColor: 'transparent', minHeight: 0, borderWidth: 0 }}
/>
              <Text size="lg" color={fg}>.stage.eth</Text>
            </Row>
          </Card>
        </Box>

        {c.hint ? (
          <Text size="sm" color={hintColor} style={{ paddingHorizontal: 18, paddingTop: 10 }}>
            {c.hint}
          </Text>
        ) : null}

        <Box margin={{ x: 16, top: 18 }}>
          <Button
            variant="primary"
            dark={dark}
            disabled={c.status !== 'free' || c.claiming}
            onPress={() => { void c.claim(); }}
            label={c.claiming ? 'Claiming…' : 'Claim'}
          />
        </Box>

        <Text size="sm" color={fg} style={{ paddingHorizontal: 18, paddingTop: 18, lineHeight: 20 }}>
          Your username is an ENS name on stage.eth, owned by your wallet. People
          can message and find you by {c.input ? `${c.name || 'yourname'}.stage.eth` : 'yourname.stage.eth'} instead of your address.
        </Text>
      </ScrollView>
    </Col>
  );
}
