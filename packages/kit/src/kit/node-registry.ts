
import type { WidgetNode } from './nodes';

type LiteralTypeOf<T> = T extends { type: infer U }
  ? string extends U
    ? never
    : U
  : never;

export type KnownNodeType = LiteralTypeOf<WidgetNode>;

const NODE_TYPE_SET: Record<KnownNodeType, true> = {
  Card: true,
  ListView: true,
  ListViewItem: true,
  Basic: true,
  Box: true,
  Row: true,
  Col: true,
  Form: true,
  Spacer: true,
  Divider: true,
  Text: true,
  Title: true,
  Caption: true,
  Markdown: true,
  Label: true,
  Image: true,
  Icon: true,
  Badge: true,
  Button: true,
  Input: true,
  Textarea: true,
  Select: true,
  Checkbox: true,
  RadioGroup: true,
  DatePicker: true,
  Switch: true,
  Tabs: true,
  TextField: true,
  ColorPicker: true,
  Spinner: true,
  Stack: true,
  ScrollRow: true,
  Scroll: true,
  Paragraph: true,
  Dialog: true,
  AvatarStack: true,
  QRCode: true,
  AudioPlayer: true,
  VideoPlayer: true,
  FilePicker: true,
  Pressable: true,
  Popover: true,
  VoiceRecorder: true,
  Transition: true,
  Chart: true,
};

export const NODE_TYPE_NAMES = Object.keys(NODE_TYPE_SET) as readonly KnownNodeType[];

export function isKnownNodeType(type: string): type is KnownNodeType {
  return Object.prototype.hasOwnProperty.call(NODE_TYPE_SET, type);
}
