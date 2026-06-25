
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
}

export interface VideoPlayerNode extends NodeBase {
  type: 'VideoPlayer';
  src: string;
  poster?: string;
  controls?: boolean;
}
