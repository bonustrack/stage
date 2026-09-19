import { Box, Col, Row } from '../src/react-native/box';
import { Input } from '../src/react-native/input';
import { Select } from '../src/react-native/select';
import { Switch } from '../src/react-native/switch';
import { Text } from '../src/react-native/text';
import { Button } from '../src/react-native/button';
import { useKitPalette } from '../src/react-native/theme-context';
import type { ArgType } from './story';
import { argToText } from './route';
import { useDark } from './scheme';

interface ControlProps {
  name: string;
  argType: ArgType;
  value: unknown;
  onChange: (next: unknown) => void;
}

function SelectControl({ argType, value, onChange }: ControlProps): React.ReactElement {
  const dark = useDark();
  const options = (argType.options ?? []).map((o) => ({ label: String(o), value: String(o) }));
  return (
    <Select
      dark={dark} size="md" block options={options} value={argToText(value)} placeholder="—"
      onChange={(next) => { onChange(next === '' ? undefined : argType.options?.find((o) => String(o) === next)); }}
    />
  );
}

function NumberControl({ argType, value, onChange }: ControlProps): React.ReactElement {
  const dark = useDark();
  const { min, max, step } = argType.control;
  const hint = min !== undefined && max !== undefined ? `${min}–${max}${step !== undefined && step !== 1 ? ` · ${step}` : ''}` : '';
  return (
    <Row gap={8} align="center">
      <Box flex={1}>
        <Input
          dark={dark} size="md" inputType="number" value={argToText(value)} placeholder={hint || 'number'}
          onChangeText={(text) => { onChange(text === '' ? undefined : Number(text)); }}
        />
      </Box>
      {hint ? <Text size="xs" role="secondary">{hint}</Text> : null}
    </Row>
  );
}

function ColorControl({ value, onChange }: ControlProps): React.ReactElement {
  const dark = useDark();
  const pal = useKitPalette();
  const swatch = typeof value === 'string' && value !== '' ? value : 'transparent';
  const edge = { width: 1, color: pal.border };
  return (
    <Row gap={8} align="center">
      <Box size={32} radius="sm" background={swatch} border={{ top: edge, right: edge, bottom: edge, left: edge }} />
      <Box flex={1}>
        <Input dark={dark} size="md" value={argToText(value)} placeholder="#rrggbb" onChangeText={(text) => { onChange(text === '' ? undefined : text); }} />
      </Box>
    </Row>
  );
}

function Control(props: ControlProps): React.ReactElement {
  const dark = useDark();
  const { type } = props.argType.control;
  if (type === 'boolean') return <Switch dark={dark} checked={props.value === true} onChange={props.onChange} />;
  if (type === 'select') return <SelectControl {...props} />;
  if (type === 'number' || type === 'range') return <NumberControl {...props} />;
  if (type === 'color') return <ColorControl {...props} />;
  return <Input dark={dark} size="md" value={argToText(props.value)} onChangeText={(text) => { props.onChange(text); }} />;
}

export function ControlsPanel({ argTypes, values, onChange, onReset }: {
  argTypes: Record<string, ArgType>;
  values: Record<string, unknown>;
  onChange: (name: string, next: unknown) => void;
  onReset: () => void;
}): React.ReactElement {
  const dark = useDark();
  return (
    <Col gap={14} padding={16}>
      <Row align="center" justify="between">
        <Text weight="semibold" size="4xl">Controls</Text>
        <Button dark={dark} size="sm" variant="ghost" color="secondary" label="Reset" onPress={onReset} />
      </Row>
      {Object.entries(argTypes).map(([name, argType]) => (
        <Col key={name} gap={4}>
          <Text size="sm" role="secondary">{name}</Text>
          <Control name={name} argType={argType} value={values[name]} onChange={(next) => { onChange(name, next); }} />
        </Col>
      ))}
    </Col>
  );
}
