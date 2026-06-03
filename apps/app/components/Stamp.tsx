/** Reusable stamp.fyi avatar.
 *
 *  Renders the deterministic identicon (or custom avatar if the address has one
 *  set on stamp.fyi) for an Ethereum address, and AUTOMATICALLY requests the
 *  right pixel size: it asks the CDN for `s = size * scale` where `scale` is the
 *  device pixel ratio capped at 3, with a 2× floor. So a 28pt avatar on a 3×
 *  phone fetches an 84px image — crisp, never upscaled-blurry — while every call
 *  site just passes the on-screen point `size`.
 *
 *  Host is `stamp.fyi` (the `cdn.` subdomain has no DNS record). URL shape:
 *    https://stamp.fyi/avatar/eth:<address>?s=<N>[&cb=<cacheBuster>]
 *
 *  Round by default (borderRadius = size / 2); pass `borderRadius` to override
 *  (e.g. 0 for a square, or a small radius for a rounded square). */

import { Image, PixelRatio } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';

interface Props {
  /** Eth address whose stamp.fyi avatar to render. */
  address: string;
  /** Rendered size in points (both width + height). */
  size: number;
  /** Corner radius. Defaults to a full circle (`size / 2`). */
  borderRadius?: number;
  /** Cache-buster appended as `&cb=…`. Pass a value that changes when the
   *  underlying avatar changes (e.g. the IPFS CID hash) so the device + CDN
   *  refetch instead of serving the stale image. */
  cacheBuster?: number | string;
  /** Extra style overrides (background colour, margin, opacity, ring, etc.). */
  style?: StyleProp<ImageStyle>;
}

/** Retina multiplier for the requested fetch size: device pixel ratio, floored
 *  at 2× (Less's explicit ask) and capped at 3× so we never request a wastefully
 *  huge image on future 4×+ panels. */
function fetchScale(): number {
  return Math.min(3, Math.max(2, PixelRatio.get()));
}

/** Build the stamp.fyi URL for `address` at on-screen `size` points. Exported so
 *  non-Image call sites (e.g. a fallback `uri` passed to another component) can
 *  reuse the exact same sizing logic. */
export function stampUrl(address: string, size: number, cacheBuster?: number | string): string {
  const s = Math.round(size * fetchScale());
  const base = `https://stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${s}`;
  return cacheBuster === undefined ? base : `${base}&cb=${encodeURIComponent(String(cacheBuster))}`;
}

export function Stamp({ address, size, borderRadius, cacheBuster, style }: Props): React.ReactElement {
  return (
    <Image
      source={{ uri: stampUrl(address, size, cacheBuster) }}
      style={[{ width: size, height: size, borderRadius: borderRadius ?? size / 2 }, style]}
    />
  );
}
