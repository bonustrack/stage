/** Wallet → Send screen.
 *
 *  v1: a form that accepts an address OR an ENS-style name (`*.eth`) and an
 *  amount-with-asset selector (ETH default — Metro's stablecoins land later).
 *  Resolution reuses lib/ens.ts (stamp.fyi). The actual transaction submit is
 *  stubbed (`Alert`) until the signer pipeline lands — same pattern as the
 *  previous "coming soon" placeholder. */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isAddress } from 'viem';
import { resolveEnsName } from '../../lib/ens';
import { useEffectiveColorScheme } from '../../lib/theme';
import { HeroIcon } from '../../components/HeroIcon';

function looksLikeEns(s: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+\.eth$|^[a-z0-9-]+\.eth$/i.test(s.trim());
}

export default function WalletSend(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const head = dark ? '#ffffff' : '#000000';
  const fg = dark ? '#9f9fa3' : '#57606a';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const bg = dark ? '#0e0f10' : '#ffffff';
  const border = dark ? '#282a2d' : '#e4e4e5';
  const inputBg = dark ? '#282a2d' : '#e4e4e5';
  const insets = useSafeAreaInsets();

  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [resolved, setResolved] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveErr, setResolveErr] = useState<string | null>(null);

  /** Debounced resolution — same flow as /search but no contact list. */
  useEffect(() => {
    const q = to.trim();
    setResolveErr(null);
    if (!q) { setResolved(null); setResolving(false); return; }
    if (isAddress(q)) { setResolved(q.toLowerCase()); setResolving(false); return; }
    if (!looksLikeEns(q)) { setResolved(null); setResolving(false); return; }
    setResolving(true);
    let cancelled = false;
    const t = setTimeout(() => {
      void (async (): Promise<void> => {
        try {
          const addr = await resolveEnsName(q.toLowerCase());
          if (cancelled) return;
          if (addr) setResolved(addr.toLowerCase());
          else { setResolved(null); setResolveErr(`No address set for ${q}`); }
        } catch (e) {
          if (!cancelled) { setResolved(null); setResolveErr((e as Error).message); }
        } finally { if (!cancelled) setResolving(false); }
      })();
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [to]);

  const canSubmit = useMemo(
    () => !!resolved && !!amount.trim() && Number(amount) > 0,
    [resolved, amount],
  );

  const onSubmit = (): void => {
    /** Signer integration lands with WalletConnect — for now we confirm the
     *  resolved payload so the form is testable end-to-end without sending. */
    Alert.alert(
      'Send',
      `Send is wired into the form but the signer is not connected yet.\n\nResolved: ${resolved}\nAmount: ${amount} ETH`,
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      {/* Topnav: back + title. */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <HeroIcon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold', flex: 1 }}>Send</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Recipient (address or ENS) */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>RECIPIENT</Text>
          <TextInput
            value={to}
            onChangeText={setTo}
            placeholder="0x… or name.eth"
            placeholderTextColor={sub}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              color: head, fontSize: 16, fontFamily: 'Calibre-Medium',
              backgroundColor: inputBg, borderRadius: 12,
              paddingHorizontal: 14, paddingVertical: 12,
            }}
          />
          {resolving ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
              <ActivityIndicator size="small" color={fg} />
              <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>Resolving…</Text>
            </View>
          ) : resolved ? (
            <Text style={{ color: fg, fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
              → {resolved}
            </Text>
          ) : resolveErr ? (
            <Text style={{ color: '#d96868', fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
              {resolveErr}
            </Text>
          ) : null}
        </View>

        {/* Amount */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>AMOUNT</Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: inputBg, borderRadius: 12,
            paddingHorizontal: 14, paddingVertical: 12, gap: 8,
          }}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.0"
              placeholderTextColor={sub}
              keyboardType="decimal-pad"
              style={{
                flex: 1, color: head, fontSize: 18, fontFamily: 'Calibre-Semibold',
                padding: 0,
              }}
            />
            <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>ETH</Text>
          </View>
          <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
            Only native ETH is supported for now — token transfers land with the WalletConnect rollout.
          </Text>
        </View>

        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => ({
            marginTop: 8, paddingVertical: 14, borderRadius: 999, alignItems: 'center',
            backgroundColor: !canSubmit ? inputBg : pressed ? '#a08458' : '#c0a06e',
            opacity: !canSubmit ? 0.6 : 1,
          })}
        >
          <Text style={{ color: !canSubmit ? sub : '#000', fontSize: 16, fontFamily: 'Calibre-Semibold' }}>
            Send
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
