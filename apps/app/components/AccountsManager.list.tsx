/**
 * @file AccountsManager list body rendering the Accounts section card (active
 * account, other accounts in flat/collapsed/expanded modes, and the Add-account row).
 */

import { Pressable } from '@metro-labs/kit/pressable';

import { Box } from './layout';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { type AccountRecord } from '../lib/accounts';
import { AccountRow } from './AccountsManager.parts';

/** Shared props passed to the AccountList sub-renderers. */
interface AccountListProps {
  flat: boolean; accounts: AccountRecord[]; activeId: string | null;
  activeRec: AccountRecord | null; otherAccounts: AccountRecord[];
  expanded: boolean; setExpanded: (fn: (e: boolean) => boolean) => void;
  head: string; sub: string; border: string; rowBg: string;
  onSwitch: (id: string) => void; setManageId: (id: string) => void; onAdd: () => void;
}

/** Builds the trailing "⋯" manage button for an account row. */
function manageTrailing(p: AccountListProps, id: string): React.ReactElement {
  return (
    <Pressable hitSlop={10} onPress={() => { p.setManageId(id); }}>
      <Text weight="semibold" size="4xl" color={p.sub} style={{ paddingHorizontal: 4 }}>⋯</Text>
    </Pressable>
  );
}

/** Renders the "No accounts yet." placeholder text. */
function EmptyAccounts({ sub }: { sub: string }): React.ReactElement {
  return <Text size="xs" color={sub} style={{ padding: 14 }}>No accounts yet.</Text>;
}

/** Renders the flat-mode list (every account as a row, active highlighted). */
function FlatAccounts(p: AccountListProps): React.ReactElement {
  if (p.accounts.length === 0) return <EmptyAccounts sub={p.sub} />;
  return (
    <>
      {p.accounts.map((a, i) => (
        <Box background={a.id === p.activeId ? p.border : 'transparent'} key={a.id}>
          <AccountRow
            rec={a} topBorder={i > 0}
            onPress={() => { p.onSwitch(a.id); }}
            onLongPress={() => { p.setManageId(a.id); }}
            head={p.head} sub={p.sub} border={p.border}
            trailing={a.id === p.activeId ? <Icon name="check" size={20} color={p.head}/> : manageTrailing(p, a.id)}
/>
        </Box>
      ))}
    </>
  );
}

/** Renders the collapsed header row (active account + chevron) for non-flat mode. */
function CollapsedHeader(p: AccountListProps): React.ReactElement | null {
  const active = p.activeRec;
  if (active) {
    return (
      <AccountRow
        rec={active} topBorder={false}
        onPress={() => { p.setExpanded(e => !e); }}
        onLongPress={() => { p.setManageId(active.id); }}
        head={p.head} sub={p.sub} border={p.border}
        trailing={<Icon name={p.expanded ? 'chevronUp' : 'chevronDown'} size={20} color={p.sub} />}
/>
    );
  }
  if (p.accounts.length === 0) return <EmptyAccounts sub={p.sub} />;
  return null;
}

/** Renders the "Add account" row plus (non-flat) the other-account rows when expanded. */
function AddSection(p: AccountListProps): React.ReactElement {
  return (
    <>
      {!p.flat ? p.otherAccounts.map(a => (
        <AccountRow
          key={a.id} rec={a} topBorder
          onPress={() => { p.onSwitch(a.id); }}
          onLongPress={() => { p.setManageId(a.id); }}
          head={p.head} sub={p.sub} border={p.border}
          trailing={manageTrailing(p, a.id)}
/>
      )) : null}
      <Pressable
        onPress={p.onAdd}
        style={({ pressed }) => ({
          paddingHorizontal: 14, paddingVertical: 12,
          flexDirection: 'row', alignItems: 'center', gap: 12,
          borderTopWidth: 1, borderTopColor: p.border,
          backgroundColor: pressed ? p.border : 'transparent',
        })}
>
        <Box width={28} height={28} radius="full" align="center" justify="center" style={{ borderWidth: 1, borderColor: p.sub, borderStyle: 'dashed' }}>
          <Icon name="plus" size={16} color={p.sub}/>
        </Box>
        <Text weight="semibold" size="md" color={p.head}>Add account</Text>
      </Pressable>
    </>
  );
}

/** Renders the Accounts section card (active account, other accounts, and the Add-account row). */
export function AccountList(p: AccountListProps): React.ReactElement {
  // Conditional style branch (flat vs card); the card branch's marginHorizontal
  // can't be a static layout prop, so the style is built here and passed as an identifier.
  const containerStyle = p.flat
    ? { backgroundColor: 'transparent' }
    : {
        marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' as const,
        borderWidth: 1, borderColor: p.border, backgroundColor: p.rowBg,
      };
  return (
    <>
      {!p.flat ? (
        <Text size="xs" color={p.sub} style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 }}>
          ACCOUNTS
        </Text>
      ) : null}
      <Box style={containerStyle}>
        {p.flat ? <FlatAccounts {...p} /> : <CollapsedHeader {...p} />}
        {p.flat || p.expanded ? <AddSection {...p} /> : null}
      </Box>
      {!p.flat ? (
        <Text size="xs" color={p.sub} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          {p.expanded ? 'Tap an account to switch · long-press for options' : 'Tap to switch or add accounts'}
        </Text>
      ) : null}
    </>
  );
}
