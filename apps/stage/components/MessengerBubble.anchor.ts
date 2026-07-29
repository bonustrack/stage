
import type { MenuPoint } from './AnchoredMenu.model';

export interface MenuAnchor { y: number; height: number; point?: MenuPoint | null }

export function initialMenuAnchor(cached: MenuAnchor, hasNode: boolean): MenuAnchor | null {
  const cachedAnchorIsValid = cached.height > 0;
  if (cachedAnchorIsValid || !hasNode) return cached;
  return null;
}
