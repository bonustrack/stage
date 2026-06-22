
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Card } from '@stage-labs/kit/react-native/card';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Box, Col, Row } from '../layout';
import { type DeployState, type ModuleRole, type useWalletModel } from './WalletSettings.parts';
import { type useEnablePasskey } from '../../lib/useEnablePasskey';
import { type useRemovePasskey } from '../../lib/useRemovePasskey';

export interface C { fg: string; head: string; sub: string; border: string; rowBg: string }

type WalletModel = NonNullable<ReturnType<typeof useWalletModel>['model']>;
type Passkey = ReturnType<typeof useEnablePasskey>;
type RemovePasskey = ReturnType<typeof useRemovePasskey>;

const ROLE_COLOR: Record<ModuleRole, 'success' | 'link' | 'secondary'> = {
  sudo: 'success', backup: 'secondary', recovery: 'link', session: 'secondary',
};

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

export function SectionLabel({ children, c }: { children: string; c: C }): React.ReactElement {
  return (
    <Text size="xs" color={c.sub} style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 }}>
      {children}
    </Text>
  );
}

function deployLabel(d: DeployState): string {
  if (d === 'loading') return 'Checking…';
  if (d === 'deployed') return 'Deployed on-chain';
  if (d === 'counterfactual') return 'Counterfactual (not yet deployed)';
  return 'Unknown';
}

export type CardFn = (children: React.ReactNode) => React.ReactElement;

export function makeCard(dark: boolean, rowBg: string, blockRadius: number): CardFn {
  return (children) => (
    <Box margin={{ x: 16 }} radius={blockRadius} style={{ overflow: 'hidden' }}>
      <Card dark={dark} background={rowBg} padding={0}>
        <ListView dark={dark}>{children}</ListView>
      </Card>
    </Box>
  );
}

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
