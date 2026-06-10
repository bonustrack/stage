/** Post-onboarding ACTIVATION screen - the identity moment (Stage #9).
 *
 *  Shown exactly once, right after the first-launch onboarding carousel
 *  ("Get started") on a clean install. A single minimal full-screen view:
 *  the user's identity is ready - their stamp avatar + resolved name/address
 *  (the SAME stamp identicon + ENS resolution used everywhere) - with one
 *  "Continue" button. Dither/Kit aesthetic, no fluff.
 *
 *  On Continue we create (find-or-create) a DM with the Tony daemon agent,
 *  pre-fill its composer with a suggested "hi", stash the conv id, and flip the
 *  persisted `activation.seen` flag. The root gate then hands off to the
 *  navigation Stack and `useStarterDmOpen()` drops the user straight INTO that
 *  chat - not on an empty Home. Tony's daemon greets when messaged, so nothing
 *  fake is seeded.
 *
 *  Self-contained: owns no navigation (the gate lives above the Stack), just an
 *  `onDone` callback the layout wires to "set seen + enter app". */

import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@metro-labs/kit/button';
import { Text } from '@metro-labs/kit/text';
import { Col, Box } from '../layout';
import { Avatar } from '../Avatar';
import { useEffectiveColorScheme } from '../../lib/theme';
import { useSelfAddress } from '../ProfileScreen.parts';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { openDmWithAddress, shortAddress } from '../../modules/messaging';
import { DAEMON_INBOX_ADDRESS } from '../../lib/pushRegister.control';
import { setDraft } from '../../lib/drafts';
import { setPendingStarterDm } from '../../lib/activationSeen';

/** Suggested first message pre-filled into the Tony DM composer. */
const STARTER_DRAFT = 'hi';

export interface ActivationProps {
  /** Called once the starter DM is ready. The layout flips `activation.seen`
   *  and lets the user into the app (where the DM auto-opens). */
  onDone: () => void;
}

export function Activation({ onDone }: ActivationProps): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const self = useSelfAddress();
  // Resolve the display name from stamp.fyi (ENS), same as every peer row.
  usePeerProfiles(self ? [self] : []);
  const displayName = (self ? getPeerName(self) : undefined)
    ?? (self ? shortAddress(self) : 'Loading…');

  const onContinue = useCallback((): void => {
    if (busy) return;
    setBusy(true);
    void (async (): Promise<void> => {
      try {
        const convId = await openDmWithAddress(DAEMON_INBOX_ADDRESS);
        setDraft(convId, STARTER_DRAFT);
        setPendingStarterDm(convId);
      } catch { /* land on Home if the DM can't be created - non-fatal */ }
      onDone();
    })();
  }, [busy, onDone]);

  return (
    <Col surface="surface" flex={1} align="center" justify="center" padding={{ x: 24 }}>
      <Col align="center" gap={16}>
        <Avatar address={self || undefined} size={96} />
        <Col align="center" gap={4}>
          <Text size="xl" weight="semibold" style={{ textAlign: 'center' }}>
            Your identity is ready
          </Text>
          <Text size="lg" style={{ textAlign: 'center' }}>{displayName}</Text>
          {self ? (
            <Text size="sm" role="secondary" style={{ textAlign: 'center' }}>
              {shortAddress(self)}
            </Text>
          ) : null}
        </Col>
      </Col>

      <Box style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
        padding={{ x: 24, bottom: 16 + insets.bottom }}
      >
        <Button
          dark={dark}
          variant="primary"
          size="lg"
          fullWidth
          label="Continue"
          loading={busy}
          onPress={onContinue}
        />
      </Box>
    </Col>
  );
}
