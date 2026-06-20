/** @file Smart-account detail sections (deploy/modules/identity/network/manage) for the Wallet settings screen. */

import { Text } from '@stage-labs/kit/text';
import { Icon } from '@stage-labs/kit/icon';
import { Card } from '@stage-labs/kit/card';
import { ListView, ListViewItem } from '@stage-labs/kit/list-view';
import { Box, Col, Row } from '../layout';
import { type DeployState, type ModuleRole, type useWalletModel } from './WalletSettings.parts';
import { type useEnablePasskey } from '../../lib/useEnablePasskey';
import { type useRemovePasskey } from '../../lib/useRemovePasskey';

/** Palette colours used by the wallet settings rows. */
export interface C { fg: string; head: string; sub: string; border: string; rowBg: string }

type WalletModel = NonNullable<ReturnType<typeof useWalletModel>['model']>;
type Passkey = ReturnType<typeof useEnablePasskey>;
type RemovePasskey = ReturnType<typeof useRemovePasskey>;

const ROLE_COLOR: Record<ModuleRole, 'success' | 'link' | 'secondary'> = {
  sudo: 'success', backup: 'secondary', recovery: 'link', session: 'secondary',
};

/** A labelled, tap-to-copy full address row. */
export function CopyRow({ label, value, dark, c, onCopy }: {
  label: string; value: string; dark: boolean; c: C; onCopy: (label: string, value: string) => void;
}): React.ReactElement {
  return (
    <ListViewItem dark={dark} align="start"
      onPress={() => { onCopy(label, value); }}
      style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
      <Col flex={1}>
        <Text size="xs" color={c.sub}>{label}</Text>
        <Text size="md" selectable color={c.fg} style={{ marginTop: 4 }}>{value}</Text>
      </Col>
      <Icon name="copy" size={18} color={c.head} />
    </ListViewItem>
  );
}

/** A plain label / value info row (no copy). */
export function InfoRow({ label, value, dark, c }: {
  label: string; value: string; dark: boolean; c: C;
}): React.ReactElement {
  return (
    <ListViewItem dark={dark} style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
      <Text size="md" color={c.sub} style={{ flex: 1 }}>{label}</Text>
      <Text size="md" color={c.fg}>{value}</Text>
    </ListViewItem>
  );
}

/** One Kernel module / validator row: name + role badge + status detail. */
function ModuleRow({ name, role, status, dark, c }: {
  name: string; role: ModuleRole; status: string; dark: boolean; c: C;
}): React.ReactElement {
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

/** Section header label. */
export function SectionLabel({ children, c }: { children: string; c: C }): React.ReactElement {
  return (
    <Text size="xs" color={c.sub} style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 }}>
      {children}
    </Text>
  );
}

/** Human-readable deploy status. */
function deployLabel(d: DeployState): string {
  if (d === 'loading') return 'Checking…';
  if (d === 'deployed') return 'Deployed on-chain';
  if (d === 'counterfactual') return 'Counterfactual (not yet deployed)';
  return 'Unknown';
}

/** Card wrapper builder bound to the current palette + radius. */
export type CardFn = (children: React.ReactNode) => React.ReactElement;

/** Build a rounded card wrapper for the wallet settings list sections. */
export function makeCard(dark: boolean, rowBg: string, blockRadius: number): CardFn {
  return (children) => (
    <Box margin={{ x: 16 }} radius={blockRadius} style={{ overflow: 'hidden' }}>
      <Card dark={dark} background={rowBg} padding={0}>
        <ListView dark={dark}>{children}</ListView>
      </Card>
    </Box>
  );
}

/** A manage-section action row (passkey enable/remove, recovery). */
function ManageRow({ dark, c, icon, label, onPress }: {
  dark: boolean; c: C; icon: React.ComponentProps<typeof Icon>['name']; label: string; onPress: () => void;
}): React.ReactElement {
  return (
    <ListViewItem dark={dark} onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
      <Icon name={icon} size={22} color={c.head} />
      <Text size="md" color={c.fg} style={{ flex: 1 }}>{label}</Text>
      <Icon name="chevronRight" size={18} color={c.head} />
    </ListViewItem>
  );
}

/** Renders the Manage section (enable/remove passkey + recovery navigation). */
function ManageSection({ dark, c, card, passkey, removePasskey, guardianCount, onRecovery }: {
  dark: boolean; c: C; card: CardFn; passkey: Passkey; removePasskey: RemovePasskey;
  guardianCount: number | undefined; onRecovery: () => void;
}): React.ReactElement {
  return (
    <>
      <SectionLabel c={c}>MANAGE</SectionLabel>
      {card(
        <>
          {passkey.available ? (
            <ManageRow dark={dark} c={c} icon="fingerPrint"
              label={passkey.busy ? 'Enabling passkey…' : 'Enable passkey for signing'}
              onPress={() => { if (!passkey.busy) passkey.run(); }} />
          ) : null}
          {removePasskey.available ? (
            <ManageRow dark={dark} c={c} icon="fingerPrint"
              label={removePasskey.busy ? 'Removing passkey…' : 'Remove passkey'}
              onPress={() => { if (!removePasskey.busy) removePasskey.run(); }} />
          ) : null}
          <ManageRow dark={dark} c={c} icon="userGroup"
            label={guardianCount ? 'Guardian recovery & backup phrase' : 'Set up recovery & backup phrase'}
            onPress={onRecovery} />
        </>,
      )}
    </>
  );
}

/** Renders the smart-account-only sections (deploy, modules, identity, network, manage). */
export function SmartAccountSections({ model, deploy, dark, c, card, passkey, removePasskey, onCopy, onRecovery }: {
  model: WalletModel; deploy: DeployState; dark: boolean; c: C; card: CardFn;
  passkey: Passkey; removePasskey: RemovePasskey;
  onCopy: (label: string, value: string) => void; onRecovery: () => void;
}): React.ReactElement {
  return (
    <>
      <SectionLabel c={c}>DEPLOY STATUS</SectionLabel>
      {card(
        <ListViewItem dark={dark} style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
          <Icon name={deploy === 'deployed' ? 'checkCircle' : 'clock'} size={20}
            color={deploy === 'deployed' ? c.head : c.sub} />
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
          <CopyRow label="XMTP identity" value={model.xmtpAddress} dark={dark} c={c} onCopy={onCopy} />
          {model.ownerAddress ? (
            <CopyRow label="Owner / recovery key (EOA)" value={model.ownerAddress} dark={dark} c={c} onCopy={onCopy} />
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

      <ManageSection dark={dark} c={c} card={card} passkey={passkey} removePasskey={removePasskey}
        guardianCount={model.guardianCount} onRecovery={onRecovery} />
    </>
  );
}
