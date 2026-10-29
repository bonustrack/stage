import { useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { acceptRequestConv, blockRequestConv } from '../lib/xmtp.conv';
import { usePalette } from '../lib/theme';
import { useWebTabRail } from '../lib/webLayout';
import { capabilities } from '../lib/capabilities';
import { Column, Row, PAGE_GUTTER } from './layout';

const FILL = { flex: 1 } as const;

export function RequestActionBar({
  convId,
  dark,
  onAccepted,
}: {
  convId: string;
  dark: boolean;
  onAccepted: () => void;
}): React.ReactElement {
  const { bg, border, link } = usePalette();
  const [busy, setBusy] = useState(false);
  const buttonStyle = useWebTabRail() ? undefined : FILL;

  const act = (request: (id: string) => Promise<unknown>, done: () => void) => (): void => {
    if (busy) return;
    setBusy(true);
    void request(convId)
      .then(done)
      .catch(() => {
        setBusy(false);
      });
  };

  return (
    <Column surface="toolbar" style={{ borderTopWidth: 1, borderTopColor: border }}>
      <Row width={'100%'} align="center" gap={10} padding={{ x: PAGE_GUTTER, y: 14 }}>
        <Button
          color="danger"
          variant="solid"
          size="lg"
          pill
          dark={dark}
          style={buttonStyle}
          loading={busy}
          disabled={busy}
          label="Reject"
          onPress={act(blockRequestConv, () => {
            capabilities.back();
          })}
        />
        <Button
          variant="primary"
          size="lg"
          pill
          dark={dark}
          style={buttonStyle}
          loading={busy}
          disabled={busy}
          label="Approve"
          tintBg={link}
          tintFg={bg}
          onPress={act(acceptRequestConv, () => {
            onAccepted();
          })}
        />
      </Row>
    </Column>
  );
}
