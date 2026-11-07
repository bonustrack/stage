export function branchFromPath(pathname: string): string | null {
  let branch: string;
  try {
    branch = decodeURIComponent(pathname.replace(/^\/+|\/+$/g, ''));
  } catch {
    return null;
  }
  return branch.split('/').every((part) => part.length > 0 && !part.startsWith('.')) ? branch : null;
}

export function branchPath(branch: string): string {
  return `/${branch.split('/').map(encodeURIComponent).join('/')}`;
}
