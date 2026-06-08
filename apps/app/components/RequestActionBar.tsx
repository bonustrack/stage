/** In-channel message-request action bar. When the open conversation is still a
 *  pending request (XMTP consent `'unknown'` - someone we never accepted started
 *  a DM / added us to a group), this renders an Approve / Reject row in place of
 *  the composer, pinned at the bottom of the conversation as the latest item.
 *
 *  It REUSES the exact same consent handlers the Requests list uses
 *  (`acceptRequestConv` → `updateConsent('allowed')`, `blockRequestConv` →
 *  `updateConsent('denied')`), so accepting/rejecting here is identical and
 *  cross-device synced.
 *
 *  - Approve → allow consent, then hand control back to the parent (which then
 *    renders the normal composer so the user can reply right away).
 *  - Reject  → deny consent, then close the conversation (router back to inbox),
 *    matching what the Requests list does on reject.
 *
 *  Additive: this is a self-contained component mounted by the conversation view
 *  behind a single consent-state check, keeping the view's edits minimal. */

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

/** Force a synced-prefs refresh so other surfaces (channels list, Requests list,
 *  other devices) converge after an in-channel accept/reject. Mirrors the
 *  Requests list's post-write syncConsent call. */
function syncConsentBestEffort(): void {
  void (getCachedXmtpClient() as unknown as {
    preferences?: { syncConsent?: () => Promise<unknown> };
  })?.preferences?.syncConsent?.();
}

export interface RequestActionBarProps {
  convId: string;
  dark: boolean;
  /** Called once consent resolves to `'allowed'` (either because the user tapped
   *  Approve here, or it was accepted elsewhere) so the parent can swap this bar
   *  out for the normal composer. */
  onAllowed: () => void;
}

/** Bottom action row for a pending message request. Renders nothing until it has
 *  confirmed the conversation is actually a pending request; once allowed, it
 *  calls `onAllowed` and renders nothing (the parent shows the composer). */
export function RequestActionBar(props: RequestActionBarProps): React.ReactElement | null {
  const { convId, dark, onAllowed } = props;
  const router = useRouter();
  const { bg, border, text: fg, link, danger, toolbarBg } = usePalette();
  const [pending, setPending] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  /** Resolve the conversation's consent state. `'unknown'` → pending request;
   *  anything else → not a request (show composer via onAllowed). */
  useEffect(() => {
    let cancelled = false;
    const resolve = async (): Promise<void> => {
      try {
        const state = await getConvConsentState(convId);
        if (cancelled) return;
        if (state === 'unknown') setPending(true);
        else { setPending(false); onAllowed(); }
      } catch {
        if (!cancelled) { setPending(false); onAllowed(); }
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
  }, [convId, onAllowed]);

  const onApprove = useCallback((): void => {
    if (busy) return;
    setBusy(true);
    void acceptRequestConv(convId)
      .then(() => { syncConsentBestEffort(); setPending(false); onAllowed(); })
      .catch(() => { setBusy(false); });
  }, [busy, convId, onAllowed]);

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
    <Box style={{
      backgroundColor: toolbarBg, borderTopWidth: 1, borderTopColor: border,
    }}>
      <Col style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 10 }}>
        <Text style={{ color: fg, textAlign: 'center', opacity: 0.8 }}>
          This is a message request. Approve to reply, or reject to decline.
        </Text>
        <Row gap={10}>
          <Box style={{ flex: 1 }}>
            <Button
              variant="danger"
              size="lg"
              pill
              dark={dark}
              fullWidth
              loading={busy}
              disabled={busy}
              label="Reject"
              tintBg={danger}
              tintFg={bg}
              onPress={onReject}
            />
          </Box>
          <Box style={{ flex: 1 }}>
            <Button
              variant="primary"
              size="lg"
              pill
              dark={dark}
              fullWidth
              loading={busy}
              disabled={busy}
              label="Approve"
              tintBg={link}
              tintFg={bg}
              onPress={onApprove}
            />
          </Box>
        </Row>
      </Col>
    </Box>
  );
}
