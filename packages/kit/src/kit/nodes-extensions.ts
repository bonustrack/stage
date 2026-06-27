
import type { ActionConfig, Color, NodeBase, SpinnerSize } from './node-fields';

export interface SpinnerNode extends NodeBase {
  type: 'Spinner';
  size?: SpinnerSize | number;
  color?: Color;
}

export interface AvatarStackItem {
  src?: string;
  fallback?: string;
}

export interface AvatarStackNode extends NodeBase {
  type: 'AvatarStack';
  items: AvatarStackItem[];
  size?: number;
  max?: number;
  overlap?: number;
  ring?: Color;
  fallbackBackground?: Color;
  moreBackground?: Color;
  moreColor?: Color;
  moreFontSize?: number;
  moreFontFamily?: string;
}

export interface QRCodeNode extends NodeBase {
  type: 'QRCode';
  value: string;
  size?: number;
  color?: Color;
  background?: Color;
}

export interface AudioPlayerNode extends NodeBase {
  type: 'AudioPlayer';
  src: string;
  duration?: number;
  onPlayAction?: ActionConfig;
  waveform?: boolean;
  bars?: number[];
  barCount?: number;
  accent?: Color;
  onAccent?: Color;
}

export interface VideoPlayerNode extends NodeBase {
  type: 'VideoPlayer';
  src: string;
  poster?: string;
  controls?: boolean;
}

export type FilePickerSource = 'library' | 'camera' | 'document';

export type FilePickerMediaType = 'images' | 'videos';

export interface FilePickerNode extends NodeBase {
  type: 'FilePicker';
  source?: FilePickerSource;
  openNonce?: number;
  onPickAction?: ActionConfig;
  onCancelAction?: ActionConfig;
  mediaTypes?: FilePickerMediaType[];
  multiple?: boolean;
  selectionLimit?: number;
  quality?: number;
  allowsEditing?: boolean;
  aspect?: [number, number];
  accept?: string;
  capture?: 'user' | 'environment';
}
