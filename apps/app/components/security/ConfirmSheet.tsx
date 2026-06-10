/** Shared transaction confirm sheet.
 *
 *  A minimal bottom sheet shown before any tx that broadcasts WITHOUT an
 *  external-wallet prompt of its own (the shielded send / shield / unshield
 *  paths sign with the local Railgun key, so there's no wallet UI to review the
 *  details). Public sends route through the connected WalletConnect wallet,
 *  which renders its own confirmation, so they don't use this.
 *
 *  Pure Kit primitives + a plain RN Modal (Kit has no Sheet primitive). Shows
 *  amount / to / network rows and Confirm / Cancel. Drive it with
 *  useConfirmSheet(): call `confirm(details)` and await the boolean. */

import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { Caption } from '@metro-labs/kit/caption';
import { Button } from '@metro-labs/kit/button';
import { useBlockRadius, usePalette } from '../../lib/theme';

export interface ConfirmDetails {
  /** Sheet title, e.g. "Confirm send". */
  title: string;
  /** Human-readable amount line, e.g. "0.5 ETH". */
  amount: string;
  /** Recipient (address / ENS / "shielded balance"). */
  to: string;
  /** Network label, e.g. "Ethereum" / "Sepolia". */
  network: string;
  /** Confirm button label. Defaults to "Confirm". */
  confirmLabel?: string;
}

interface SheetState extends ConfirmDetails {
  visible: boolean;
  resolve: ((ok: boolean) => void) | null;
}

const HIDDEN: SheetState = {
  visible: false, resolve: null, title: '', amount: '', to: '', network: '',
};

export interface ConfirmSheetController {
  /** Open the sheet; resolves true on Confirm, false on Cancel/dismiss. */
  confirm: (details: ConfirmDetails) => Promise<boolean>;
  /** Render this inside the screen so the sheet has a mount point. */
  element: React.ReactElement;
}

export function useConfirmSheet(): ConfirmSheetController {
  const [state, setState] = useState<SheetState>(HIDDEN);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((details: ConfirmDetails): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ ...details, visible: true, resolve });
    });
  }, []);

  const close = useCallback((ok: boolean): void => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setState(HIDDEN);
  }, []);

  const element = (
    <ConfirmSheetView state={state} onResult={close} />
  );

  return { confirm, element };
}

function Detail({ label, value, sub }: { label: string; value: string; sub: string }): React.ReactElement {
  const { text: fg } = usePalette();
  return (
    <Row align="center" justify="between" gap={12}>
      <Caption color={sub}>{label}</Caption>
      <Text size="md" weight="semibold" color={fg} numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </Row>
  );
}

function ConfirmSheetView(
  { state, onResult }: { state: SheetState; onResult: (ok: boolean) => void },
): React.ReactElement {
  const { text: fg, border } = usePalette();
  const sub = fg;
  const insets = useSafeAreaInsets();
  const blockRadius = useBlockRadius();

  return (
    <Modal
      visible={state.visible}
      transparent
      animationType="slide"
      onRequestClose={() => onResult(false)}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        onPress={() => onResult(false)}
      >
        {/* Stop taps inside the sheet from dismissing it. */}
        <Pressable onPress={() => undefined}>
          <Box
            surface="raised"
            padding={{ x: 20, top: 20, bottom: 20 + insets.bottom }}
            style={{
              borderTopLeftRadius: blockRadius, borderTopRightRadius: blockRadius,
              borderTopWidth: 1, borderColor: border,
            }}
          >
            <Col gap={16}>
              <Text size="2xl" weight="semibold" color={fg}>{state.title}</Text>
              <Box radius={blockRadius} surface="surface" padding={14}
                style={{ borderWidth: 1, borderColor: border }}>
                <Col gap={10}>
                  <Detail label="Amount" value={state.amount} sub={sub} />
                  <Detail label="To" value={state.to} sub={sub} />
                  <Detail label="Network" value={state.network} sub={sub} />
                </Col>
              </Box>
              <Row gap={12}>
                <Box flex={1}>
                  <Button label="Cancel" variant="secondary" block onPress={() => onResult(false)} />
                </Box>
                <Box flex={1}>
                  <Button label={state.confirmLabel ?? 'Confirm'} block onPress={() => onResult(true)} />
                </Box>
              </Row>
            </Col>
          </Box>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
