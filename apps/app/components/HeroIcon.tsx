/** Heroicons v1 outline — paths copied from tailwindlabs/heroicons@v1/optimized/outline.
 * Stroke is currentColor, fill is transparent. viewBox is the v1 outline standard 24×24.
 * Active state is signalled by `strokeWidth=2.4` (subtle thickening) — keeps shapes
 * consistent across states (the v1 "solid" variant uses a different 20×20 viewBox and
 * mixing the two produces glitched icons).
 */

import { Path, Svg } from 'react-native-svg';

const PATHS: Record<string, string> = {
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  // paper-airplane — direct chat with the assistant
  send: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8',
  // inbox — fits "all conversations land here"
  list: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
  cog: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  // photo — image picker
  photo: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  // paper-clip — file picker
  paperClip: 'M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13',
  // microphone — voice recorder start
  microphone: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  // emoji-happy / face-smile — reaction trigger
  faceSmile: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  // stop — recorder stop (filled square)
  stop: 'M5 5h14v14H5z',
  // x — close / dismiss
  x: 'M6 18L18 6M6 6l12 12',
  // plus — attachment menu trigger
  plus: 'M12 4v16m8-8H4',
  // play — audio playback trigger (heroicons v1 outline, in-circle variant)
  play: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  // pause — audio playback toggle
  pause: 'M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z',
  // reply — quote a message in the composer (heroicons v1 "reply")
  reply: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6',
  // arrow-down — scroll-to-bottom jump button
  arrowDown: 'M19 14l-7 7m0 0l-7-7m7 7V3',
};

export type HeroIconName = keyof typeof PATHS;

interface Props {
  name: HeroIconName;
  size?: number;
  color?: string;
  focused?: boolean;
}

export function HeroIcon({ name, size = 24, color = 'currentColor' }: Props): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={PATHS[name]}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
