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
  /** Reports whether the open conversation is a pending message request. The
   *  parent defaults to showing the composer and only hides it (swapping in this
   *  bar) when this fires `true`. Fired `false` when consent is allowed/denied,
   *  resolution fails, or the user approves here, so the composer (re)appears.
   *  Defaulting the parent to composer-visible avoids flashing the composer in
   *  late for the common already-accepted case. */
  onPending: (pending: boolean) => void;
}

/** Bottom action row for a pending message request. Renders nothing until it has
 *  confirmed the conversation is actually a pending request; while pending it
 *  reports `onPending(true)` and renders the Approve/Reject row. Once allowed it
 *  reports `onPending(false)` and renders nothing (the parent shows composer). */
export function RequestActionBar(props: RequestActionBarProps): React.ReactElement | null {
  const { convId, dark, onPending } = props;
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
    <Box style={{
      backgroundColor: toolbarBg, borderTopWidth: 1, borderTopColor: border,
    }}>
      <Col style={{
        width: '100%', alignSelf: 'stretch', alignItems: 'stretch',
        paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 10,
      }}>
        <Text color={fg} style={{ textAlign: 'center', opacity: 0.8 }}>
          This is a message request. Approve to reply, or reject to decline.
        </Text>
        {/* Full-bleed row: each half flexes to fill the width. NOTE: do NOT use
         *  the Button `pill` prop here - `pill` forces a fixed square (width =
         *  height) circular icon button, which collapses these to tiny circles
         *  regardless of `fullWidth`. We want full-width rounded buttons, so we
         *  rely on `fullWidth` (alignSelf:'stretch' + width:'100%') instead. */}
        <Row gap={10} style={{ width: '100%', alignSelf: 'stretch' }}>
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
