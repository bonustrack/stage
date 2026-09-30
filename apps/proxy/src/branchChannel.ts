const LITERAL_CHARACTER = /^[A-Za-z0-9.-]$/;

export function channelKey(branch: string): string {
  return Array.from(new TextEncoder().encode(branch), (byte) => {
    const character = String.fromCharCode(byte);
    return LITERAL_CHARACTER.test(character) ? character : `_${byte.toString(16).padStart(2, '0')}`;
  }).join('');
}

export function branchFromPath(pathname: string): string | null {
  let branch: string;
  try {
    branch = decodeURIComponent(pathname.replace(/^\/+|\/+$/g, ''));
  } catch {
    return null;
  }
  const parts = branch.split('/');
  return parts.every((part) => part.length > 0 && !part.startsWith('.')) ? branch : null;
}

export function branchPath(branch: string): string {
  return `/${branch.split('/').map(encodeURIComponent).join('/')}`;
}
