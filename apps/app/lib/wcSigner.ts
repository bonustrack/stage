/** Bridge between the WalletConnect-connected wallet (wagmi lives in React
 *  context) and the XMTP client builder (lib/xmtp.ts, a plain module). The
 *  Settings screen registers a sign fn once a wallet is connected; xmtp.ts
 *  calls it to sign the *one-time* installation-registration challenge for a
 *  WalletConnect account. Reads/sends after registration use the on-device
 *  installation key, so this signer is only needed during the initial connect. */

export type WcSignFn = (message: string) => Promise<string>;

let wcSign: WcSignFn | null = null;

export function setWcSign(fn: WcSignFn | null): void { wcSign = fn; }
export function getWcSign(): WcSignFn | null { return wcSign; }
