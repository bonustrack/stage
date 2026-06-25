
import type { ReactNode } from 'react';
import type {
  AudioPlayerNode,
  AvatarStackNode,
  ColorPickerNode,
  PressableNode,
  QRCodeNode,
  SpinnerNode,
  SwitchNode,
  TabsNode,
  TextFieldNode,
  VideoPlayerNode,
} from '../kit';
import {
  resolveOptionalColor,
  resolveSpinnerSize,
} from '../kit';
import { AudioPlayer } from './audio-player';
import { AvatarStack } from './avatar-stack';
import { ColorPicker } from './color-picker';
import { GesturePressable, type SwipeDir } from './gesture-pressable';
import { QrCode } from './qr-code';
import { Spinner } from './spinner';
import { Switch } from './switch';
import { Tabs, type TabsOptionView } from './tabs';
import { TextField } from './text-field';
import { VideoPlayer } from './video-player';
import {
  dispatch,
  renderList,
  resolveIconName,
  type NodeRenderer,
  type RenderCtx,
} from './kit-render-shared';

export function renderSpinner(node: SpinnerNode, ctx: RenderCtx): ReactNode {
  return (
    <Spinner
      size={resolveSpinnerSize(node.size)}
      color={resolveOptionalColor(node.color, ctx.scheme)}
    />
  );
}

export function renderSwitch(node: SwitchNode, ctx: RenderCtx): ReactNode {
  ctx.form?.set(node.name, node.checked);
  return (
    <Switch
      name={node.name}
      checked={node.checked}
      label={node.label}
      disabled={node.disabled}
      dark={ctx.dark}
      onChange={(checked) => {
        ctx.form?.set(node.name, checked);
        dispatch(node.onChangeAction, ctx, { [node.name]: checked });
      }}
    />
  );
}

export function renderTabs(node: TabsNode, ctx: RenderCtx): ReactNode {
  const options: TabsOptionView[] = node.options.map((opt) => ({
    value: opt.value,
    label: opt.label,
    icon: resolveIconName(opt.icon),
  }));
  return (
    <Tabs
      value={node.value}
      options={options}
      variant={node.variant === 'underline' ? 'underline' : 'segmented'}
      dark={ctx.dark}
      onChange={(value) => {
        ctx.form?.set(node.name, value);
        dispatch(node.onChangeAction, ctx, { [node.name]: value });
      }}
    />
  );
}

export function renderTextField(node: TextFieldNode, ctx: RenderCtx): ReactNode {
  ctx.form?.set(node.name, node.value);
  return (
    <TextField
      name={node.name}
      value={node.value}
      placeholder={node.placeholder}
      multiline={node.multiline}
      autoFocus={node.autoFocus}
      autoGrow={node.autoGrow}
      disabled={node.disabled}
      selection={node.selection}
      dark={ctx.dark}
      onChangeText={(text) => {
        ctx.form?.set(node.name, text);
        dispatch(node.onChangeAction, ctx, { [node.name]: text });
      }}
      onSelectionChange={
        node.onSelectionChangeAction === undefined
          ? undefined
          : (range) => {
              dispatch(node.onSelectionChangeAction, ctx, {
                start: range.start,
                end: range.end,
              });
            }
      }
    />
  );
}

export function renderColorPicker(node: ColorPickerNode, ctx: RenderCtx): ReactNode {
  ctx.form?.set(node.name, node.value);
  return (
    <ColorPicker
      value={node.value}
      swatches={node.swatches}
      dark={ctx.dark}
      onChange={(value) => {
        ctx.form?.set(node.name, value);
        dispatch(node.onChangeAction, ctx, { [node.name]: value });
      }}
    />
  );
}

export function renderAvatarStack(node: AvatarStackNode, ctx: RenderCtx): ReactNode {
  return (
    <AvatarStack
      items={node.items}
      size={node.size}
      max={node.max}
      overlap={node.overlap}
      dark={ctx.dark}
    />
  );
}

export function renderQRCode(node: QRCodeNode, ctx: RenderCtx): ReactNode {
  return (
    <QrCode
      value={node.value}
      size={node.size}
      color={resolveOptionalColor(node.color, ctx.scheme)}
      background={resolveOptionalColor(node.background, ctx.scheme)}
    />
  );
}

export function renderAudioPlayer(node: AudioPlayerNode, ctx: RenderCtx): ReactNode {
  return (
    <AudioPlayer
      src={node.src}
      duration={node.duration}
      dark={ctx.dark}
      onPlay={() => {
        dispatch(node.onPlayAction, ctx);
      }}
    />
  );
}

export function renderVideoPlayer(node: VideoPlayerNode): ReactNode {
  return (
    <VideoPlayer src={node.src} poster={node.poster} controls={node.controls} />
  );
}

export function renderPressable(
  node: PressableNode,
  ctx: RenderCtx,
  render: NodeRenderer,
): ReactNode {
  const swipe = (direction: SwipeDir): void => {
    dispatch(node.onSwipeAction, ctx, { direction });
  };
  const press = (): void => {
    dispatch(node.onClickAction, ctx);
  };
  const longPress = (): void => {
    dispatch(node.onLongPressAction, ctx);
  };
  return (
    <GesturePressable
      onPress={node.onClickAction ? press : undefined}
      onLongPress={node.onLongPressAction ? longPress : undefined}
      onSwipe={node.onSwipeAction ? swipe : undefined}
    >
      {renderList(node.children, ctx, render)}
    </GesturePressable>
  );
}
