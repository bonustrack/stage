
import { useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { fontName, fontSize, readableForeground } from '../tokens';
import { Box, Row, Col } from './box';
import { Glyph } from './glyph';
import { Input } from './input';
import { Text } from './text';
import { useKitPalette } from './theme-context';
import { hexToHsv, hsvToHex, isHexColor } from '../color-math';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';

export type ColorPickerMode = 'swatches' | 'hsv';

export interface ColorPickerProps {
  value: string;
  mode?: ColorPickerMode;
  swatches?: string[];
  onChange?: (value: string) => void;
  dark?: boolean;
  headColor?: string;
  subColor?: string;
  borderColor?: string;
  rowBg?: string;
}

export const DEFAULT_SWATCHES = [
  '#000000',
  '#ffffff',
  '#eb4c5b',
  '#e07a0c',
  '#e0a106',
  '#1f9d57',
  '#2f6df6',
  '#8b5cf6',
];

interface HsvPalette {
  dark: boolean;
  head: string;
  sub: string;
  border: string;
  rowBg: string;
}

const TRACK_H = 26;

function Track({ colors, thumb, onFraction, p }: {
  colors: string[]; thumb: number;
  onFraction: (f: number) => void; p: HsvPalette;
}): React.ReactElement {
  const widthRef = useRef(1);
  const emit = (x: number): void => {
    onFraction(Math.max(0, Math.min(1, x / widthRef.current)));
  };
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(0)
      .shouldCancelWhenOutside(false)
      .onBegin((e) => { runOnJS(emit)(e.x); })
      .onUpdate((e) => { runOnJS(emit)(e.x); });
    return pan;
  }, [onFraction]);
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

function hueStops(): string[] {
  return Array.from({ length: 24 }, (_, i) => hsvToHex((i / 23) * 360, 1, 1));
}

function Label({ text, p }: { text: string; p: HsvPalette }): React.ReactElement {
  return (
    <Text weight="semibold" size="xs" color={p.sub} style={{ marginTop: 16, marginBottom: 6 }}>
      {text}
    </Text>
  );
}

function HsvPicker({ value, onChange, p }: {
  value: string; onChange: (hex: string) => void; p: HsvPalette;
}): React.ReactElement {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [text, setText] = useState<string | null>(null);
  const hex = hsvToHex(hsv.h, hsv.s, hsv.v);

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
          if (isHexColor(t)) { setHsv(hexToHsv(t)); onChange(t.trim().toLowerCase()); }
        }}
        dark={p.dark}
        inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
        placeholder="#rrggbb" placeholderTextColor={p.sub}
        style={{
          marginTop: 4, paddingVertical: 8, paddingHorizontal: 12, minHeight: 0,
          borderRadius: 10, borderWidth: 1, borderColor: p.border,
          backgroundColor: p.rowBg,
          color: text != null && !isHexColor(text) ? '#eb4c5b' : p.head,
          fontSize: fontSize('md'), fontFamily: fontName.sans,
        }}
/>
    </Box>
  );
}

function Swatches({ value, swatches = DEFAULT_SWATCHES, onChange, dark = false }: ColorPickerProps): React.ReactElement {
  const border = dark ? '#3a3c40' : '#d8d8da';
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {swatches.map((hex) => {
        const selected = hex.toLowerCase() === value.toLowerCase();
        return (
          <Pressable
            key={hex}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange?.(hex)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: hex,
              borderWidth: 1,
              borderColor: border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {selected ? <Glyph icon={IconCheckmark1} size={18} color={readableForeground(hex)} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function ColorPicker(props: ColorPickerProps): React.ReactElement {
  const { value, mode = 'swatches', onChange, dark = false } = props;
  const palette = useKitPalette();
  if (mode === 'hsv') {
    const p: HsvPalette = {
      dark,
      head: props.headColor ?? palette.text,
      sub: props.subColor ?? palette.sub,
      border: props.borderColor ?? palette.border,
      rowBg: props.rowBg ?? palette.inputBg,
    };
    return <HsvPicker value={value} onChange={(hex) => onChange?.(hex)} p={p}/>;
  }
  return <Swatches {...props} />;
}
