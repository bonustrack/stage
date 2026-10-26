import { CONTROL_SIZES, type ControlSize } from '../src/control.styles';
import { CONTROL_RADIUS_DEFAULT, fontFamily } from '../src/tokens';
import { Text } from '../src/react-native/text';
import { Button } from '../src/react-native/button';
import { useKitPalette } from '../src/react-native/theme-context';
import type { ArgType } from './story';
import { argToText } from './route';
import { useDark } from './scheme';
import { Column } from '../src/react-native/column';
import { Row } from '../src/react-native/row';
import { TextField } from '../src/react-native/text-field';
import { CheckBox } from '../src/react-native/check-box';

interface ControlProps {
  name: string;
  argType: ArgType;
  value: unknown;
  size: ControlSize;
  onChange: (next: unknown) => void;
}

function SelectControl({ argType, value, size, onChange }: ControlProps): React.ReactElement {
  const pal = useKitPalette();
  const box = CONTROL_SIZES[size];
  return (
    <select
      value={argToText(value)}
      onChange={(event) => { onChange(event.target.value === '' ? undefined : argType.options?.find((o) => String(o) === event.target.value)); }}
      style={{
        minHeight: box.minHeight, padding: `0 ${box.paddingHorizontal}px`, borderRadius: CONTROL_RADIUS_DEFAULT, border: 'none', outline: 'none',
        background: pal.inputBg, color: pal.link, fontFamily: fontFamily.sans.join(', '), fontSize: box.fontSize,
      }}
    >
      <option value="">-</option>
      {(argType.options ?? []).map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
    </select>
  );
}

function NumberControl({ argType, value, size, onChange }: ControlProps): React.ReactElement {
  const dark = useDark();
  const { min, max, step } = argType.control;
  const hint = min !== undefined && max !== undefined ? `${min}–${max}${step !== undefined && step !== 1 ? ` · ${step}` : ''}` : '';
  return (
    <Row gap={8} align="center">
      <Column weight={1}>
        <TextField
          dark={dark} size={size} variant="number" value={argToText(value)} placeholder={hint || 'number'}
          onChangeText={(text) => { onChange(text === '' ? undefined : Number(text)); }}
        />
      </Column>
      {hint ? <Text size="3xs" color="secondary">{hint}</Text> : null}
    </Row>
  );
}

function ColorControl({ value, size, onChange }: ControlProps): React.ReactElement {
  const dark = useDark();
  const pal = useKitPalette();
  const swatch = typeof value === 'string' && value !== '' ? value : 'transparent';
  const edge = { width: 1, color: pal.border };
  return (
    <Row gap={8} align="center">
      <Column size={32} radius="sm" background={swatch} border={{ top: edge, right: edge, bottom: edge, left: edge }} />
      <Column weight={1}>
        <TextField dark={dark} size={size} value={argToText(value)} placeholder="#rrggbb" onChangeText={(text) => { onChange(text === '' ? undefined : text); }} />
      </Column>
    </Row>
  );
}

function Control(props: ControlProps): React.ReactElement {
  const dark = useDark();
  const { type } = props.argType.control;
  if (type === 'boolean') return <CheckBox displayStyle="switch" dark={dark} value={props.value === true} onChange={props.onChange} />;
  if (type === 'select') return <SelectControl {...props} />;
  if (type === 'number' || type === 'range') return <NumberControl {...props} />;
  if (type === 'color') return <ColorControl {...props} />;
  return <TextField dark={dark} size={props.size} value={argToText(props.value)} onChangeText={(text) => { props.onChange(text); }} />;
}

export function ControlsPanel({ argTypes, values, onChange, onReset, touch = false }: {
  argTypes: Record<string, ArgType>;
  values: Record<string, unknown>;
  onChange: (name: string, next: unknown) => void;
  onReset: () => void;
  touch?: boolean;
}): React.ReactElement {
  const dark = useDark();
  return (
    <Column gap={14} padding={16}>
      <Row align="center" justify="spaceBetween">
        <Text fontWeight="semibold" size="xl">Controls</Text>
        <Button dark={dark} size={touch ? 'md' : 'sm'} variant="ghost" color="secondary" label="Reset" onPress={onReset} />
      </Row>
      {Object.entries(argTypes).map(([name, argType]) => (
        <Column key={name} gap={4}>
          <Text size="2xs" color="secondary">{name}</Text>
          <Control name={name} argType={argType} value={values[name]} size={touch ? 'lg' : 'md'} onChange={(next) => { onChange(name, next); }} />
        </Column>
      ))}
    </Column>
  );
}
