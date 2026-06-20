/** @file In-channel Approve/Reject action bar shown in place of the composer when the open conversation is still a pending XMTP message request, reusing the Requests list's consent handlers. */

import { useCallback, useEffect, useState } from 'react';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import { useRouter } from 'expo-router';
import {
  getConvConsentState, acceptRequestConv, blockRequestConv,
  getCachedXmtpClient, streamConvConsent,
} from '../modules/messaging';
import { usePalette } from '../lib/theme';
import { Box, Col, Row } from './layout';

/** Force a synced-prefs refresh so other surfaces (channels list, Requests list, other devices) converge after an in-channel accept/reject. Mirrors the Requests list's post-write syncConsent call. */
function syncConsentBestEffort(): void {
  void (getCachedXmtpClient() as unknown as {
    preferences?: { syncConsent?: () => Promise<unknown> };
  })?.preferences?.syncConsent?.();
}

export interface RequestActionBarProps {
  convId: string;
  dark: boolean;
  /** Reports whether the open conversation is a pending request: parent shows the composer by default and hides it only on `true`; fired `false` once allowed/denied/approved so the composer reappears. */
  onPending: (pending: boolean) => void;
}

/** Bottom action row for a pending message request: renders nothing until confirmed pending, then reports onPending(true) with the Approve/Reject row; once allowed reports onPending(false) and renders nothing. */
export function RequestActionBar(props: RequestActionBarProps): React.ReactElement | null {
  const { convId, dark, onPending } = props;
  const router = useRouter();
  const { bg, border, text: fg, link, danger } = usePalette();
  const [pending, setPending] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  /** Resolve the conversation's consent state. `'unknown'` → pending request; anything else → not a request (show composer via onAllowed). */
  useEffect(() => {
    let cancelled = false;
    /** Resolve helper. */
    const resolve = async (): Promise<void> => {
      try {
        const state = await getConvConsentState(convId);
        if (cancelled) return;
        if (state === 'unknown') { setPending(true); onPending(true); }
        else { setPending(false); onPending(false); }
      } catch {
        if (!cancelled) { setPending(false); onPending(false); }
      }
    };
    void resolve();
    /** Reconcile if the request is accepted/blocked on another device while open. */
    let cancelConsent: (() => void) | null = null;
    try { cancelConsent = streamConvConsent(() => { void resolve(); }); }
    catch { /* best-effort */ }
    return (): void => {
      cancelled = true;
      if (cancelConsent) try { cancelConsent(); } catch { /* ignore */ }
    };
  }, [convId, onPending]);

  const onApprove = useCallback((): void => {
    if (busy) return;
    setBusy(true);
    void acceptRequestConv(convId)
      .then(() => { syncConsentBestEffort(); setPending(false); onPending(false); })
      .catch(() => { setBusy(false); });
  }, [busy, convId, onPending]);

  const onReject = useCallback((): void => {
    if (busy) return;
    setBusy(true);
    void blockRequestConv(convId)
      .then(() => {
        syncConsentBestEffort();
        /** Match the Requests list reject: drop the conversation + leave the view. */
        if (router.canGoBack()) router.back(); else router.replace('/');
      })
      .catch(() => { setBusy(false); });
  }, [busy, convId, router]);

  if (pending !== true) return null;

  return (
    <Box surface="toolbar" style={{ borderTopWidth: 1, borderTopColor: border }}>
      <Col width={'100%'} padding={{ x: 16, top: 12, bottom: 12 }} align="stretch" gap={10} style={{ alignSelf: 'stretch' }}>
        <Text color={fg} style={{ textAlign: 'center', opacity: 0.8 }}>
          This is a message request. Approve to reply, or reject to decline.
        </Text>
        {/* Full-bleed row: each half flexes to fill the width; do NOT use the Button `pill` prop (it forces a fixed square circle) — rely on `fullWidth` for full-width rounded buttons. */}
        <Row width={'100%'} gap={10} style={{ alignSelf: 'stretch' }}>
          <Col flex={1} style={{ alignSelf: 'stretch' }}>
            <Button
              variant="danger"
              size="lg"
              dark={dark}
              fullWidth
              loading={busy}
              disabled={busy}
              label="Reject"
              tintBg={danger}
              tintFg={bg}
              onPress={onReject}
/>
          </Col>
          <Col flex={1} style={{ alignSelf: 'stretch' }}>
            <Button
              variant="primary"
              size="lg"
              dark={dark}
              fullWidth
              loading={busy}
              disabled={busy}
              label="Approve"
              tintBg={link}
              tintFg={bg}
              onPress={onApprove}
/>
          </Col>
        </Row>
      </Col>
    </Box>
  );
}
