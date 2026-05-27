/** Wallet tab — shows the logged-in account's address + mainnet ETH balance. */

import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { createPublicClient, http, formatEther, type Hex } from 'viem';
import { mainnet } from 'viem/chains';
import { getOrCreateXmtpClient, shortAddress, stampBoxAvatarUrl } from '../../lib/xmtp';
import { usePeerProfiles, getPeerName, getPeerAvatarCb } from '../../lib/peerProfiles';
import { useEffectiveColorScheme } from '../../lib/theme';

export default function Wallet(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const head = dark ? '#ffffff' : '#000000';
  const fg = dark ? '#9f9fa3' : '#57606a';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const bg = dark ? '#0e0f10' : '#ffffff';
  const border = dark ? '#282a2d' : '#e4e4e5';
  const card = dark ? '#282a2d' : '#e4e4e5';

  const [address, setAddress] = useState<string>('');
  const [balance, setBalance] = useState<string | null>(null);
  const [err, setErr] = useState<string>('');
  usePeerProfiles([address]);

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        const addr = client.publicIdentity.identifier;
        if (cancelled) return;
        setAddress(addr);
        /** Read-only mainnet RPC via brovider (the same proxy Snapshot UI uses —
         *  viem's default public endpoint was failing). Just an eth_getBalance. */
        const pub = createPublicClient({ chain: mainnet, transport: http('https://rpc.brovider.xyz/1') });
        const wei = await pub.getBalance({ address: addr as Hex });
        if (!cancelled) setBalance(formatEther(wei));
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const eth = balance === null ? null : Number(balance);
  const ethLabel = eth === null ? '' : eth.toLocaleString(undefined, { maximumFractionDigits: 5 });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: head, fontSize: 22, fontFamily: 'Calibre-Semibold' }}>Wallet</Text>
      </View>

      <View style={{
        marginHorizontal: 16, marginTop: 8, padding: 20, borderRadius: 16,
        backgroundColor: card, borderWidth: 1, borderColor: border, alignItems: 'center',
      }}>
        {address ? (
          <Image
            source={{ uri: stampBoxAvatarUrl(address, 120, getPeerAvatarCb(address)) }}
            style={{ width: 60, height: 60, borderRadius: 999, backgroundColor: border }}
          />
        ) : (
          <View style={{ width: 60, height: 60, borderRadius: 999, backgroundColor: border }} />
        )}
        <Text style={{ color: head, fontSize: 17, fontFamily: 'Calibre-Semibold', marginTop: 12 }} numberOfLines={1}>
          {getPeerName(address) ?? (address ? shortAddress(address) : '—')}
        </Text>
        <Pressable onPress={() => { if (address) { void Clipboard.setStringAsync(address); } }} hitSlop={6}>
          <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 2 }}>
            {address ? shortAddress(address) : ''}{address ? '  ·  tap to copy' : ''}
          </Text>
        </Pressable>

        <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', marginTop: 20 }}>
          BALANCE · ETHEREUM
        </Text>
        {err ? (
          <Text style={{ color: '#d96868', fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 4, textAlign: 'center' }}>
            Couldn’t load balance
          </Text>
        ) : (
          <Text style={{ color: head, fontSize: 34, fontFamily: 'Calibre-Semibold', marginTop: 2 }}>
            {eth === null ? '…' : `${ethLabel} ETH`}
          </Text>
        )}
      </View>

      <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', textAlign: 'center', marginTop: 16, paddingHorizontal: 24 }}>
        This is the wallet you’re logged in with. Balance is read live from Ethereum mainnet.
      </Text>
    </ScrollView>
  );
}
