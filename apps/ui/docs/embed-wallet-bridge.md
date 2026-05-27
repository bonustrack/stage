# Embed wallet bridge — let the Metro widget use the host's wallet

When the Metro chat widget is embedded as an iframe, it can sign XMTP identity
operations with the **host page's already-connected wallet** instead of minting
its own throwaway key. The widget never holds a key — it asks the parent window
to sign over `postMessage`, and the host signs with its own provider (wagmi /
viem / `window.ethereum`).

The user sees ~**one** wallet prompt the first time they open the widget (XMTP
inbox creation + installation registration). After that nothing is signed per
message — the local DB + installation key take over.

## Protocol (postMessage)

| Direction | Message | Meaning |
|---|---|---|
| widget → host | `{ type: 'metro:account-request' }` | "what wallet is connected?" |
| host → widget | `{ type: 'metro:account', address }` | connected EOA (lowercase 0x…). Omit/empty `address` to decline → widget falls back to a local key. Re-send on connect/switch/disconnect. |
| widget → host | `{ type: 'metro:sign-request', id, message }` | `personal_sign` this UTF-8 string |
| host → widget | `{ type: 'metro:sign-response', id, signature }` | `0x…` hex signature |
| host → widget | `{ type: 'metro:sign-response', id, error }` | user rejected / failed |

`id` correlates a sign-request with its response. The widget only accepts
messages whose `event.source` is the parent frame; the host should likewise
verify `event.origin` is the Metro widget origin (e.g. `https://metro.box`).

## Drop-in snippet (wagmi v2)

Paste alongside wherever you mount the `<iframe src="https://metro.box/…">`:

```ts
import { getAccount, signMessage } from '@wagmi/core';
import { wagmiConfig } from './your-wagmi-config';

const METRO_ORIGIN = 'https://metro.box';

function postToMetro(iframe: HTMLIFrameElement, msg: unknown) {
  iframe.contentWindow?.postMessage(msg, METRO_ORIGIN);
}

export function wireMetroWalletBridge(iframe: HTMLIFrameElement) {
  // Push the connected address whenever the widget asks, and on every change.
  const sendAccount = () =>
    postToMetro(iframe, { type: 'metro:account', address: getAccount(wagmiConfig).address ?? '' });

  window.addEventListener('message', async (e) => {
    if (e.origin !== METRO_ORIGIN || e.source !== iframe.contentWindow) return;
    const d = e.data;
    if (d?.type === 'metro:account-request') {
      sendAccount();
    } else if (d?.type === 'metro:sign-request' && typeof d.message === 'string') {
      try {
        const signature = await signMessage(wagmiConfig, { message: d.message });
        postToMetro(iframe, { type: 'metro:sign-response', id: d.id, signature });
      } catch (err) {
        postToMetro(iframe, { type: 'metro:sign-response', id: d.id, error: String(err) });
      }
    }
  });

  // Proactively notify on wallet connect / switch / disconnect.
  // (wagmi) watchAccount(wagmiConfig, { onChange: sendAccount });
}
```

That's the whole host side. The widget handles the rest (XMTP client creation
keyed to the returned address, reuse across reloads without re-signing).

## Notes

- **Security:** both sides pin origins. The host signs only `personal_sign` of
  short XMTP identity strings — never transactions.
- **Wallet switch:** when the host posts a new `metro:account` address, the
  widget rebuilds its XMTP client for that identity (re-prompting once for the
  new wallet).
- **No host bridge?** If the host never answers `metro:account-request`, the
  widget falls back to its local throwaway key after a short timeout — existing
  embeds keep working unchanged.
