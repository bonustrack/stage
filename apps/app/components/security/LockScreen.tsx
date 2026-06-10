/** Full-screen App Lock overlay.
 *
 *  Rendered by the root layout OVER the app whenever App Lock is armed (cold
 *  start, or a foreground resume after > BACKGROUND_GRACE_MS in background).
 *  Minimal dither aesthetic: a single centred lock glyph + an Unlock button that
 *  triggers the biometric / device-credential prompt. On success it calls
 *  onUnlock so the layout drops the overlay and reveals the app.
 *
 *  Auto-prompts once on mount so the user lands straight on the OS prompt. If
 *  the native module is unavailable (JS-only OTA before an APK rebuild) the
 *  prompt reports `unavailable` and we fail OPEN — never trap the user behind a
 *  lock that can't be satisfied. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Col } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { Caption } from '@metro-labs/kit/caption';
import { Button } from '@metro-labs/kit/button';
import { Icon } from '@metro-labs/kit/icon';
import { usePalette } from '../../lib/theme';
import { authenticate } from '../../lib/appLock';

export function LockScreen({ onUnlock }: { onUnlock: () => void }): React.ReactElement {
  const { text: fg, link: head } = usePalette();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const tried = useRef(false);

  const tryUnlock = useCallback(() => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    void (async (): Promise<void> => {
      const res = await authenticate('Unlock Metro');
      setBusy(false);
      // Fail OPEN when the device can't authenticate at all (no native module /
      // no enrolled credential) so the app is never permanently locked out.
      if (res.ok || res.reason === 'unavailable') { onUnlock(); return; }
      setFailed(true);
    })();
  }, [busy, onUnlock]);

  // Auto-prompt once on mount.
  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    tryUnlock();
  }, [tryUnlock]);

  return (
    <Col surface="surface" flex={1} align="center" justify="center" gap={20}>
      <Icon name="lockClosed" size={48} color={head} />
      <Col align="center" gap={4}>
        <Text size="2xl" weight="semibold" color={fg}>Metro is locked</Text>
        <Caption color={fg}>
          {failed ? 'Authentication failed. Try again.' : 'Unlock to continue.'}
        </Caption>
      </Col>
      <Button label="Unlock" onPress={tryUnlock} loading={busy} disabled={busy} />
    </Col>
  );
}
