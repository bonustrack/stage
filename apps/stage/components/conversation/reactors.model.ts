import { shortAddress } from '@stage-labs/client/identity/format';

const MAX_NAMED = 3;

export const SELF_NAME = 'You';

export type ReactorNamer = (uri: string) => string;

export function reactorNamer(
  addressOf: (uri: string) => string | null, peerName: (address: string) => string | undefined,
): ReactorNamer {
  return (uri) => {
    const address = addressOf(uri);
    if (!address) return shortAddress(uri.slice(uri.lastIndexOf('/') + 1));
    return peerName(address) ?? shortAddress(address);
  };
}

export function reactorNames(reactors: readonly string[], myUri: string, nameOf: ReactorNamer): string[] {
  const others = reactors.filter(uri => uri !== myUri).map(nameOf);
  return reactors.includes(myUri) ? [SELF_NAME, ...others] : others;
}

export function reactorNamesByMessage(
  reactions: Map<string, Map<string, string[]>>, myUri: string, nameOf: ReactorNamer,
): Map<string, Map<string, string[]>> {
  const out = new Map<string, Map<string, string[]>>();
  for (const [msgId, byEmoji] of reactions) {
    const named = new Map<string, string[]>();
    for (const [emoji, reactors] of byEmoji) named.set(emoji, reactorNames(reactors, myUri, nameOf));
    out.set(msgId, named);
  }
  return out;
}

export function reactorsLabel(names: readonly string[]): string {
  if (names.length > MAX_NAMED) {
    return `${names.slice(0, MAX_NAMED - 1).join(', ')} and ${names.length - (MAX_NAMED - 1)} others`;
  }
  const last = names.at(-1) ?? '';
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${last}` : last;
}
