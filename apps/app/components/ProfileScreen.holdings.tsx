/** @file ProfileHoldings: a profile's public Tokens + NFTs tabs for the viewed address, reusing the Wallet-tab presentational components. */

import { useEffect, useRef, useState } from 'react';

import { Pressable } from '@stage-labs/kit/pressable';
import { Text } from '@stage-labs/kit/text';
import { Spinner } from './Spinner';
import { Col, Row } from './layout';
import { DANGER, usePalette } from '../lib/theme';
import { fetchAssetRows } from './tabs/WalletScreen.data';
import { type AssetRow } from './tabs/WalletScreen.assets';
import { TokensList } from './tabs/WalletScreen.tokens';
import { NftsView } from './tabs/WalletScreen.parts';
import { getNftsAcrossChains, type Nft } from '../lib/opensea';

type HoldingsTab = 'tokens' | 'nfts';
const TAB_LABEL: Record<HoldingsTab, string> = { tokens: 'Tokens', nfts: 'NFTs' };

/** Tokens | NFTs underline tabs — mirrors WalletTabs styling (no Activity/ Railgun on a peer profile). */
function HoldingsTabs({ tab, setTab, head, sub, border }: {
  tab: HoldingsTab; setTab: (t: HoldingsTab) => void; head: string; sub: string; border: string;
}): React.ReactElement {
  return (
    <Row margin={{ x: 16, top: 22, bottom: 6 }} justify="start" gap={24}
      style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      {(['tokens', 'nfts'] as const).map(t => {
        const active = tab === t;
        return (
          <Pressable
            key={t}
            onPress={() => { setTab(t); }}
            style={{
              paddingVertical: 10,
              marginBottom: -1,
              borderBottomWidth: 2,
              borderBottomColor: active ? head : 'transparent',
            }}
>
            <Text weight="semibold" size="3xl" color={active ? head : sub}>
              {TAB_LABEL[t]}
            </Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

/** Renders the holdings section of a profile with tabs for tokens and other assets. */
export function ProfileHoldings({ address }: { address: string }): React.ReactElement {
  const { link: head, text: sub, bg, border } = usePalette();

  const [tab, setTab] = useState<HoldingsTab>('tokens');

  const [rows, setRows] = useState<AssetRow[] | null>(null);
  const [err, setErr] = useState(false);

  const [nfts, setNfts] = useState<Nft[] | null>(null);
  const [nftStatus, setNftStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  /** Public token balances for the VIEWED address (no Railgun — shielded balances are private to their owner and never visible on a peer profile). */
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setRows(null);
    setErr(false);
    void (async (): Promise<void> => {
      try {
        const next = await fetchAssetRows(address);
        if (!cancelled) setRows(next);
      } catch {
        if (!cancelled) setErr(true);
      }
    })();
    return () => { cancelled = true; };
  }, [address]);

  /** Lazy-load NFTs on the first switch to the NFTs tab, cached per address. Guard re-fetch by the loaded address (not by status) — see WalletScreen. */
  const loadedAddrRef = useRef<string | null>(null);
  useEffect(() => {
    if (tab !== 'nfts' || !address || loadedAddrRef.current === address) return;
    loadedAddrRef.current = address;
    let cancelled = false;
    setNftStatus('loading');
    void (async (): Promise<void> => {
      try {
        const list = await getNftsAcrossChains(address);
        if (cancelled) return;
        setNfts(list);
        setNftStatus('ready');
      } catch {
        if (!cancelled) setNftStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [tab, address]);

  return (
    <Col>
      <HoldingsTabs tab={tab} setTab={setTab} head={head} sub={sub} border={border}/>

      {tab === 'nfts' ? (
        <NftsView status={nftStatus} nfts={nfts} head={head} sub={sub} border={border}/>
      ) : err ? (
        <Col padding={{ y: 40 }} margin={{ x: 16 }} align="center">
          <Text size="md" color={DANGER}>
            Couldn’t load tokens
          </Text>
        </Col>
      ) : rows === null ? (
        <Col padding={{ y: 40 }} margin={{ x: 16 }} align="center">
          <Spinner size={28} color={head}/>
        </Col>
      ) : rows.filter(r => Number(r.balance) > 0).length === 0 ? (
        <Col padding={{ y: 40 }} margin={{ x: 16 }} align="center">
          <Text size="md" color={sub}>
            There are no tokens in this wallet.
          </Text>
        </Col>
      ) : (
        /* Public rows only — no shielded (privateRows) and no pending shields on a peer profile. */
        <TokensList
          rows={rows} privateRows={[]} pending={[]}
          head={head} sub={sub} border={border} bg={bg}
/>
      )}
    </Col>
  );
}
