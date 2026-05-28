/** Wallet tab — shows the logged-in account's address + mainnet ETH/USDC balance,
 *  with Send/Receive shortcuts. Balances are fetched in a single Multicall3 round-trip
 *  via the brovider RPC (the same proxy Snapshot UI uses; viem's default public
 *  endpoint was failing). */

import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { createPublicClient, http, formatEther, formatUnits, type Hex } from 'viem';
import { mainnet } from 'viem/chains';
import { getOrCreateXmtpClient, shortAddress, stampBoxAvatarUrl } from '../../lib/xmtp';
import { usePeerProfiles, getPeerName, getPeerAvatarCb } from '../../lib/peerProfiles';
import { useEffectiveColorScheme } from '../../lib/theme';
import { HeroIcon, type HeroIconName } from '../../components/HeroIcon';

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;
/** Circle USDC on Ethereum mainnet (6 decimals). */
const USDC_MAINNET = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const;

const erc20Abi = [{
  name: 'balanceOf', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'a', type: 'address' }],
  outputs: [{ name: 'b', type: 'uint256' }],
}] as const;
const multicall3Abi = [{
  name: 'getEthBalance', type: 'function', stateMutability: 'view',
  inputs: [{ name: 'a', type: 'address' }],
  outputs: [{ name: 'b', type: 'uint256' }],
}] as const;

export default function Wallet(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const head = dark ? '#ffffff' : '#000000';
  const fg = dark ? '#9f9fa3' : '#57606a';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const bg = dark ? '#0e0f10' : '#ffffff';
  const border = dark ? '#282a2d' : '#e4e4e5';
  const card = dark ? '#282a2d' : '#e4e4e5';

  const [address, setAddress] = useState<string>('');
  const [eth, setEth] = useState<string | null>(null);
  const [usdc, setUsdc] = useState<string | null>(null);
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
        const pub = createPublicClient({ chain: mainnet, transport: http('https://rpc.brovider.xyz/1') });
        /** One round-trip via Multicall3: ETH via getEthBalance + USDC balanceOf. */
        const [ethRes, usdcRes] = await pub.multicall({
          contracts: [
            { address: MULTICALL3, abi: multicall3Abi, functionName: 'getEthBalance', args: [addr as Hex] },
            { address: USDC_MAINNET, abi: erc20Abi, functionName: 'balanceOf', args: [addr as Hex] },
          ],
        });
        if (cancelled) return;
        if (ethRes.status === 'success') setEth(formatEther(ethRes.result));
        if (usdcRes.status === 'success') setUsdc(formatUnits(usdcRes.result, 6));
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const fmt = (v: string | null, maxFrac = 5): string => v === null ? '…'
    : Number(v).toLocaleString(undefined, { maximumFractionDigits: maxFrac });

  const onSend = (): void => Alert.alert('Send', 'Send is coming soon.');
  const onReceive = (): void => {
    if (!address) return;
    void Clipboard.setStringAsync(address);
    Alert.alert('Receive', `Copy this address to receive funds:\n\n${address}`);
  };

  const Btn = ({ icon, label, onPress }: { icon: HeroIconName; label: string; onPress: () => void }): React.ReactElement => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        flexDirection: 'row', gap: 8,
        backgroundColor: pressed ? border : card, borderWidth: 1, borderColor: border,
      })}
    >
      <HeroIcon name={icon} size={18} color={head} />
      <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold' }}>{label}</Text>
    </Pressable>
  );

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
          <>
            <Text style={{ color: head, fontSize: 34, fontFamily: 'Calibre-Semibold', marginTop: 2 }}>
              {fmt(eth)} ETH
            </Text>
            <Text style={{ color: fg, fontSize: 17, fontFamily: 'Calibre-Medium', marginTop: 4 }}>
              {fmt(usdc, 2)} USDC
            </Text>
          </>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 12 }}>
        <Btn icon="send" label="Send" onPress={onSend} />
        <Btn icon="arrowDown" label="Receive" onPress={onReceive} />
      </View>

      <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', textAlign: 'center', marginTop: 16, paddingHorizontal: 24 }}>
        This is the wallet you’re logged in with. Balances read live from Ethereum mainnet via Multicall3.
      </Text>
    </ScrollView>
  );
}
