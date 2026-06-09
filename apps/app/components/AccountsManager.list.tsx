/** AccountsManager list body — the ACCOUNTS section card (flat / collapsed /
 *  expanded modes + the "Add account" row + footer hint). Extracted from
 *  AccountsManager for lint line-budget. Rendering identical. */

import { Pressable } from '@metro-labs/kit/pressable';

import { Box } from './layout';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { type AccountRecord } from '../lib/accounts';
import { AccountRow } from './AccountsManager.parts';

export function AccountList({
  flat, accounts, activeId, activeRec, otherAccounts, expanded, setExpanded,
  head, sub, border, rowBg, onSwitch, setManageId, setAddOpen,
}: {
  flat: boolean; accounts: AccountRecord[]; activeId: string | null;
  activeRec: AccountRecord | null; otherAccounts: AccountRecord[];
  expanded: boolean; setExpanded: (fn: (e: boolean) => boolean) => void;
  head: string; sub: string; border: string; rowBg: string;
  onSwitch: (id: string) => void; setManageId: (id: string) => void; setAddOpen: (b: boolean) => void;
}): React.ReactElement {
  const manageTrailing = (id: string): React.ReactElement => (
    <Pressable hitSlop={10} onPress={() => setManageId(id)}>
      <Text weight="semibold" size="4xl" color={sub} style={{ paddingHorizontal: 4 }}>⋯</Text>
    </Pressable>
  );

  return (
    <>
      {!flat ? (
        <Text size="xs" color={sub} style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 }}>
          ACCOUNTS
        </Text>
      ) : null}
      <Box style={flat ? {
        backgroundColor: 'transparent',
      } : {
        marginHorizontal: 16, borderRadius: 12, overflow: 'hidden',
        borderWidth: 1, borderColor: border, backgroundColor: rowBg,
      }}>
        {flat ? (
          /* Flat mode (modal) — EVERY account as a row, all visible at once,
             active one highlighted. No collapse/dropdown. */
          accounts.length === 0 ? (
            <Text size="xs" color={sub} style={{ padding: 14 }}>
              No accounts yet.
            </Text>
          ) : (
            accounts.map((a, i) => (
              <Box key={a.id} style={{ backgroundColor: a.id === activeId ? border : 'transparent' }}>
                <AccountRow
                  rec={a}
                  topBorder={i > 0}
                  onPress={() => onSwitch(a.id)}
                  onLongPress={() => setManageId(a.id)}
                  head={head} sub={sub} border={border}
                  trailing={
                    a.id === activeId
                      ? <Icon name="check" size={20} color={head} />
                      : manageTrailing(a.id)
                  }
                />
              </Box>
            ))
          )
        ) : (
          /* Collapsed header row — the ACTIVE account + a chevron. Tapping it
             toggles the dropdown of the other accounts. */
          activeRec ? (
            <AccountRow
              rec={activeRec}
              topBorder={false}
              onPress={() => setExpanded(e => !e)}
              onLongPress={() => setManageId(activeRec.id)}
              head={head} sub={sub} border={border}
              trailing={<Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={20} color={sub} />}
            />
          ) : accounts.length === 0 ? (
            <Text size="xs" color={sub} style={{ padding: 14 }}>
              No accounts yet.
            </Text>
          ) : null
        )}

        {/* Expanded (non-flat) OR always (flat) — followed by "Add account".
            In flat mode the OTHER accounts are already rendered above. */}
        {flat || expanded ? (
          <>
            {!flat ? otherAccounts.map(a => (
              <AccountRow
                key={a.id}
                rec={a}
                topBorder
                onPress={() => onSwitch(a.id)}
                onLongPress={() => setManageId(a.id)}
                head={head} sub={sub} border={border}
                trailing={manageTrailing(a.id)}
              />
            )) : null}
            <Pressable
              onPress={() => setAddOpen(true)}
              style={({ pressed }) => ({
                paddingHorizontal: 14, paddingVertical: 12,
                flexDirection: 'row', alignItems: 'center', gap: 12,
                borderTopWidth: 1, borderTopColor: border,
                backgroundColor: pressed ? border : 'transparent',
              })}
            >
              <Box style={{ width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: sub, borderStyle: 'dashed' }}>
                <Icon name="plus" size={16} color={sub} />
              </Box>
              <Text weight="semibold" size="md" color={head}>Add account</Text>
            </Pressable>
          </>
        ) : null}
      </Box>
      {!flat ? (
        <Text size="xs" color={sub} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          {expanded ? 'Tap an account to switch · long-press for options' : 'Tap to switch or add accounts'}
        </Text>
      ) : null}
    </>
  );
}
