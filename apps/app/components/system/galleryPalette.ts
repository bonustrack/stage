/** Small theme-token bundle shared by the Kit + Components gallery sections and
 *  the color editor. Replaces the old story-harness ControlPalette: same shape,
 *  no story machinery. `head` is the heading/foreground color, `sub` the muted
 *  secondary, `rowBg` a subtle fill. */
export interface GalleryPalette {
  dark: boolean;
  head: string;
  sub: string;
  border: string;
  rowBg: string;
}
