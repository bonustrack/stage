/**
 * @file Settings -> Wallet screen: a read-only view of the active ZeroDev
 *  smart-account (address, signer, Kernel modules, deploy status, versions, XMTP
 *  address) with a link to recovery, displaying addresses and metadata only.
 */

import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Card } from '@metro-labs/kit/card';
import { ListView, ListViewItem } from '@metro-labs/kit/list-view';
import { Box, Col, Row } from '../layout';
import { SystemHeader } from '../system/SystemHeader';
import { useBlockRadius, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { useActiveAccount } from '../../modules/messaging/account';
import { flash } from '../../lib/toast';
import { useWalletModel, type DeployState, type ModuleRole } from './WalletSettings.parts';
import { useEnablePasskey } from '../../lib/useEnablePasskey';
import { useRemovePasskey } from '../../lib/useRemovePasskey';

interface C { fg: string; head: string; sub: string; border: string; rowBg: string }

/** A labelled, tap-to-copy full address row. */
function CopyRow(
  { label, value, dark, c }: { label: string; value: string; dark: boolean; c: C },
): React.ReactElement {
  return (
    <ListViewItem
      dark={dark}
      align="start"
      onPress={() => { void Clipboard.setStringAsync(value); flash(`${label} copied`); }}
      style={{ paddingHorizontal: 14, paddingVertical: 14 }}
    >
      <Col flex={1}>
        <Text size="xs" color={c.sub}>{label}</Text>
        <Text size="md" selectable color={c.fg} style={{ marginTop: 4 }}>{value}</Text>
      </Col>
      <Icon name="copy" size={18} color={c.head} />
    </ListViewItem>
  );
}

/** A plain label / value info row (no copy). */
function InfoRow(
  { label, value, dark, c }: { label: string; value: string; dark: boolean; c: C },
): React.ReactElement {
  return (
    <ListViewItem dark={dark} style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
      <Text size="md" color={c.sub} style={{ flex: 1 }}>{label}</Text>
      <Text size="md" color={c.fg}>{value}</Text>
    </ListViewItem>
  );
}

const ROLE_COLOR: Record<ModuleRole, 'success' | 'link' | 'secondary'> = {
  sudo: 'success', backup: 'secondary', recovery: 'link', session: 'secondary',
};

/** One Kernel module / validator row: name + role badge + status detail. */
function ModuleRow(
  { name, role, status, dark, c }: { name: string; role: ModuleRole; status: string; dark: boolean; c: C },
): React.ReactElement {
  return (
    <ListViewItem dark={dark} align="start" style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
      <Col flex={1}>
        <Row align="center" gap={8}>
          <Text size="md" color={c.fg}>{name}</Text>
          <Text size="xs" role={ROLE_COLOR[role]} style={{ textTransform: 'uppercase' }}>{role}</Text>
        </Row>
        <Text size="xs" color={c.sub} style={{ marginTop: 3 }}>{status}</Text>
      </Col>
    </ListViewItem>
  );
}

/** Deploy Label. */
function deployLabel(d: DeployState): string {
  if (d === 'loading') return 'Checking…';
  if (d === 'deployed') return 'Deployed on-chain';
  if (d === 'counterfactual') return 'Counterfactual (not yet deployed)';
  return 'Unknown';
}

/** The Section Label component. */
function SectionLabel({ children, c }: { children: string; c: C }): React.ReactElement {
  return (
    <Text size="xs" color={c.sub} style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 }}>
      {children}
    </Text>
  );
}

/** Renders the wallet settings screen for managing the account's wallet. */
// eslint-disable-next-line max-lines-per-function -- TODO(chaitu): refactor to satisfy function-size limits
export function WalletSettings(): React.ReactElement {
  const epoch = useActiveAccount();
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const blockRadius = useBlockRadius();
  const insets = useSafeAreaInsets();
  const c: C = { fg, head, sub: fg, border, rowBg: border };

  const { model, deploy } = useWalletModel(epoch);
  const passkey = useEnablePasskey(epoch);
  const removePasskey = useRemovePasskey(epoch);

  /** Card helper. */
  const card = (children: React.ReactNode): React.ReactElement => (
    <Box margin={{ x: 16 }} radius={blockRadius} style={{ overflow: 'hidden' }}>
      <Card dark={dark} background={c.rowBg} padding={0}>
        <ListView dark={dark}>{children}</ListView>
      </Card>
    </Box>
  );

  return (
    <Col surface="surface" flex={1}>
      <SystemHeader title="Wallet" dark={dark} fg={fg} head={head} border={border} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        {!model ? (
          <Text size="md" color={c.sub} style={{ padding: 24 }}>No active account.</Text>
        ) : (
          <>
            <SectionLabel c={c}>ACCOUNT</SectionLabel>
            {card(
              <>
                <InfoRow label="Name" value={model.label} dark={dark} c={c} />
                {model.hdIndex != null ? (
                  <InfoRow label="HD index" value={`#${model.hdIndex}`} dark={dark} c={c} />
                ) : null}
                <InfoRow
                  label="Type"
                  value={model.isSmart ? 'Smart account (ZeroDev Kernel)' : `Legacy (${model.rec.type})`}
                  dark={dark} c={c}
                />
                {model.isSmart ? (
                  <InfoRow label="Active signer" value={model.activeSigner} dark={dark} c={c} />
                ) : null}
              </>,
            )}

            <SectionLabel c={c}>{model.isSmart ? 'SMART ACCOUNT ADDRESS' : 'ADDRESS'}</SectionLabel>
            {card(<CopyRow label="Address" value={model.address} dark={dark} c={c} />)}

            {model.isSmart ? (
              <>
                <SectionLabel c={c}>DEPLOY STATUS</SectionLabel>
                {card(
                  <ListViewItem dark={dark} style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
                    <Icon
                      name={deploy === 'deployed' ? 'checkCircle' : 'clock'}
                      size={20}
                      color={deploy === 'deployed' ? c.head : c.sub}
                    />
                    <Text size="md" color={c.fg} style={{ flex: 1 }}>{deployLabel(deploy)}</Text>
                  </ListViewItem>,
                )}

                <SectionLabel c={c}>MODULES / VALIDATORS</SectionLabel>
                {card(
                  model.modules.map((m) => (
                    <ModuleRow key={`${m.name}-${m.role}`} name={m.name} role={m.role} status={m.status} dark={dark} c={c} />
                  )),
                )}

                <SectionLabel c={c}>IDENTITY</SectionLabel>
                {card(
                  <>
                    <CopyRow label="XMTP identity" value={model.xmtpAddress} dark={dark} c={c} />
                    {model.ownerAddress ? (
                      <CopyRow label="Owner / recovery key (EOA)" value={model.ownerAddress} dark={dark} c={c} />
                    ) : null}
                  </>,
                )}

                <SectionLabel c={c}>NETWORK</SectionLabel>
                {card(
                  <>
                    <InfoRow label="Chain" value={`Base (${model.chainId})`} dark={dark} c={c} />
                    <InfoRow label="Kernel" value={`v${model.kernelVersion}`} dark={dark} c={c} />
                    <InfoRow label="EntryPoint" value={`v${model.entryPointVersion}`} dark={dark} c={c} />
                  </>,
                )}

                <SectionLabel c={c}>MANAGE</SectionLabel>
                {card(
                  <>
                    {passkey.available ? (
                      <ListViewItem
                        dark={dark}
                        onPress={() => { if (!passkey.busy) passkey.run(); }}
                        style={{ paddingHorizontal: 14, paddingVertical: 14 }}
                      >
                        <Icon name="fingerPrint" size={22} color={c.head} />
                        <Text size="md" color={c.fg} style={{ flex: 1 }}>
                          {passkey.busy ? 'Enabling passkey…' : 'Enable passkey for signing'}
                        </Text>
                        <Icon name="chevronRight" size={18} color={c.head} />
                      </ListViewItem>
                    ) : null}
                    {removePasskey.available ? (
                      <ListViewItem
                        dark={dark}
                        onPress={() => { if (!removePasskey.busy) removePasskey.run(); }}
                        style={{ paddingHorizontal: 14, paddingVertical: 14 }}
                      >
                        <Icon name="fingerPrint" size={22} color={c.head} />
                        <Text size="md" color={c.fg} style={{ flex: 1 }}>
                          {removePasskey.busy ? 'Removing passkey…' : 'Remove passkey'}
                        </Text>
                        <Icon name="chevronRight" size={18} color={c.head} />
                      </ListViewItem>
                    ) : null}
                    <ListViewItem
                      dark={dark}
                      onPress={() => { router.push('/wallet/recovery'); }}
                      style={{ paddingHorizontal: 14, paddingVertical: 14 }}
                    >
                      <Icon name="userGroup" size={22} color={c.head} />
                      <Text size="md" color={c.fg} style={{ flex: 1 }}>
                        {model.guardianCount ? 'Guardian recovery & backup phrase' : 'Set up recovery & backup phrase'}
                      </Text>
                      <Icon name="chevronRight" size={18} color={c.head} />
                    </ListViewItem>
                  </>,
                )}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </Col>
  );
}
