
export interface MenuAnchor { y: number; height: number }

export function initialMenuAnchor(cached: MenuAnchor, hasNode: boolean): MenuAnchor | null {
  const cachedAnchorIsValid = cached.height > 0;
  if (cachedAnchorIsValid || !hasNode) return cached;
  return null;
}
