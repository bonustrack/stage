/** @file Pure-JS visual color picker with three draggable HSV sliders, a live preview swatch, and a hex text field, driven by react-native-gesture-handler with no native module. */

import { useMemo, useRef, useState } from 'react';
import { fontSize } from '@stage-labs/kit/tokens';
import { Input } from '@stage-labs/kit/input';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Box, Row, Col } from '../layout';
import { Text } from '@stage-labs/kit/text';
import type { GalleryPalette } from './galleryPalette';
import { isHex } from '../../lib/colorOverrides';
import { hexToHsv, hsvToHex } from './colorMath';

const TRACK_H = 26;

/** The Track component. */
function Track({ colors, thumb, onFraction, p }: {
  colors: string[]; thumb: number;
  onFraction: (f: number) => void; p: GalleryPalette;
}): React.ReactElement {
  /** Track width via onLayout; the gesture's `x` is relative to the whole track so fraction is reliable mid-drag, and a default of 1 (not 0) avoids a divide-by-zero before first layout. */
  const widthRef = useRef(1);
  /** Emit helper. */
  const emit = (x: number): void => {
    onFraction(Math.max(0, Math.min(1, x / widthRef.current)));
  };
  const gesture = useMemo(() => {
    /** minDistance(0) activates the pan on the first touch with no threshold and emits onBegin so a plain tap registers; the parent ScrollView scrolls only vertically so this zero-distance pan wins the first touch. */
    const pan = Gesture.Pan()
      .minDistance(0)
      .shouldCancelWhenOutside(false)
      .onBegin((e) => { runOnJS(emit)(e.x); })
      .onUpdate((e) => { runOnJS(emit)(e.x); });
    return pan;
  }, [onFraction]);
  /** Stepped gradient via N stacked flex slices (no native gradient dep). */
  return (
    <GestureDetector gesture={gesture}>
      <Box height={TRACK_H} radius={TRACK_H / 2}
        onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width || 1; }}
        justify="center" style={{ overflow: 'hidden' }}
>
        <Row style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
          {colors.map((c, i) => (
            <Col background={c} flex={1} key={i}/>
          ))}
        </Row>
        <Box width={22} height={22} radius="md" background={'transparent'} margin={{ left: -11 }}
          pointerEvents="none"
          style={{ position: 'absolute', left: `${thumb * 100}%`, borderWidth: 3, borderColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 2, elevation: 3 }}
/>
        <Box radius={TRACK_H / 2} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderWidth: 1, borderColor: p.border }}/>
      </Box>
    </GestureDetector>
  );
}

/** Hue Stops. */
function hueStops(): string[] {
  return Array.from({ length: 24 }, (_, i) => hsvToHex((i / 23) * 360, 1, 1));
}

/** Renders an HSV color picker for selecting a theme color. */
export function ColorPicker({ value, onChange, p }: {
  value: string; onChange: (hex: string) => void; p: GalleryPalette;
}): React.ReactElement {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [text, setText] = useState<string | null>(null);
  const hex = hsvToHex(hsv.h, hsv.s, hsv.v);

  /** Apply helper. */
  const apply = (h: number, s: number, v: number): void => {
    setHsv({ h, s, v });
    setText(null);
    onChange(hsvToHex(h, s, v));
  };

  const satStops = Array.from({ length: 12 }, (_, i) => hsvToHex(hsv.h, i / 11, hsv.v));
  const valStops = Array.from({ length: 12 }, (_, i) => hsvToHex(hsv.h, hsv.s, i / 11));

  return (
    <Box>
      <Row gap={14} align="center">
        <Box width={64} height={64} radius="lg" background={hex} style={{ borderWidth: 1, borderColor: p.border }}/>
        <Col flex={1}>
          <Text weight="semibold" size="5xl" color={p.head}>
            {hex}
          </Text>
          <Text size="xs" color={p.sub} style={{ marginTop: 2 }}>
            live preview
          </Text>
        </Col>
      </Row>

      <Label text="Hue" p={p}/>
      <Track colors={hueStops()} thumb={hsv.h / 360} p={p}
        onFraction={(f) => { apply(f * 360, hsv.s, hsv.v); }}/>
      <Label text="Saturation" p={p}/>
      <Track colors={satStops} thumb={hsv.s} p={p}
        onFraction={(f) => { apply(hsv.h, f, hsv.v); }}/>
      <Label text="Value" p={p}/>
      <Track colors={valStops} thumb={hsv.v} p={p}
        onFraction={(f) => { apply(hsv.h, hsv.s, f); }}/>

      <Label text="Hex" p={p}/>
      <Input
        value={text ?? hex}
        onChangeText={(t) => {
          setText(t);
          if (isHex(t)) { setHsv(hexToHsv(t)); onChange(t.trim().toLowerCase()); }
        }}
        dark={p.dark}
        inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
        placeholder="#rrggbb" placeholderTextColor={p.sub}
        style={{
          marginTop: 4, paddingVertical: 8, paddingHorizontal: 12, minHeight: 0,
          borderRadius: 10, borderWidth: 1, borderColor: p.border,
          backgroundColor: p.rowBg,
          color: text != null && !isHex(text) ? '#eb4c5b' : p.head,
          fontSize: fontSize('md'), fontFamily: 'Calibre-Medium',
        }}
/>
    </Box>
  );
}

/** The Label component. */
function Label({ text, p }: { text: string; p: GalleryPalette }): React.ReactElement {
  return (
    <Text weight="semibold" size="xs" color={p.sub} style={{ marginTop: 16, marginBottom: 6 }}>
      {text}
    </Text>
  );
}
