
import type { ReactNode } from 'react';
import type {
  AudioPlayerNode,
  AvatarStackNode,
  ColorPickerNode,
  FilePickerNode,
  PopoverNode,
  PressableNode,
  QRCodeNode,
  SpinnerNode,
  SwitchNode,
  TabsNode,
  TextFieldNode,
  VideoPlayerNode,
  VoiceRecorderNode,
} from '../kit';
import {
  resolveColor,
  resolveOptionalColor,
  resolveRadius,
  resolveSpinnerSize,
  resolveWeight,
} from '../kit';
import { AudioPlayer } from './audio-player';
import { AvatarStack } from './avatar-stack';
import { ColorPicker } from './color-picker';
import { FilePicker } from './file-picker';
import { VoiceRecorder } from './voice-recorder';
import { GesturePressable, type SwipeDir } from './gesture-pressable';
import { Popover, type PopoverItemView } from './popover';
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
      rows={node.rows}
      autoFocus={node.autoFocus}
      autoGrow={node.autoGrow}
      disabled={node.disabled}
      selection={node.selection}
      focusNonce={node.focusNonce}
      blurNonce={node.blurNonce}
      variant={node.variant}
      background={resolveOptionalColor(node.background, ctx.scheme)}
      borderColor={resolveOptionalColor(node.borderColor, ctx.scheme)}
      radius={resolveRadius(node.radius)}
      paddingX={node.paddingX}
      paddingY={node.paddingY}
      paddingTop={node.paddingTop}
      paddingBottom={node.paddingBottom}
      lineHeight={node.lineHeight}
      fontSize={node.fontSize}
      fontFamily={node.fontFamily ?? resolveWeight(node.fontWeight)}
      color={resolveOptionalColor(node.color, ctx.scheme)}
      placeholderColor={resolveOptionalColor(node.placeholderColor, ctx.scheme)}
      noFocusBorder={node.noFocusBorder}
      maxLength={node.maxLength}
      maxHeight={node.maxHeight}
      minHeight={node.minHeight}
      returnKeyType={node.returnKeyType}
      autoCapitalize={node.autoCapitalize}
      autoCorrect={node.autoCorrect}
      inputMode={node.inputMode}
      dark={ctx.dark}
      onChangeText={(text) => {
        ctx.form?.set(node.name, text);
        dispatch(node.onChangeAction, ctx, { [node.name]: text });
      }}
      onSubmit={
        node.onSubmitAction === undefined
          ? undefined
          : () => {
              dispatch(node.onSubmitAction, ctx, { [node.name]: node.value });
            }
      }
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
      mode={node.mode}
      swatches={node.swatches}
      headColor={resolveOptionalColor(node.headColor, ctx.scheme)}
      subColor={resolveOptionalColor(node.subColor, ctx.scheme)}
      borderColor={resolveOptionalColor(node.borderColor, ctx.scheme)}
      rowBg={resolveOptionalColor(node.rowBg, ctx.scheme)}
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
      ring={resolveOptionalColor(node.ring, ctx.scheme)}
      fallbackBackground={resolveOptionalColor(node.fallbackBackground, ctx.scheme)}
      moreBackground={resolveOptionalColor(node.moreBackground, ctx.scheme)}
      moreColor={resolveOptionalColor(node.moreColor, ctx.scheme)}
      moreFontSize={node.moreFontSize}
      moreFontFamily={node.moreFontFamily}
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
      waveform={node.waveform}
      bars={node.bars}
      barCount={node.barCount}
      accent={resolveOptionalColor(node.accent, ctx.scheme)}
      onAccent={resolveOptionalColor(node.onAccent, ctx.scheme)}
      onPlay={() => {
        dispatch(node.onPlayAction, ctx);
      }}
    />
  );
}

export function renderFilePicker(node: FilePickerNode, ctx: RenderCtx): ReactNode {
  return (
    <FilePicker
      openNonce={node.openNonce}
      source={node.source}
      mediaTypes={node.mediaTypes}
      multiple={node.multiple}
      selectionLimit={node.selectionLimit}
      quality={node.quality}
      allowsEditing={node.allowsEditing}
      aspect={node.aspect}
      onPick={(files) => {
        dispatch(node.onPickAction, ctx, { files });
      }}
      onCancel={() => {
        dispatch(node.onCancelAction, ctx);
      }}
    />
  );
}

export function renderVideoPlayer(node: VideoPlayerNode): ReactNode {
  return (
    <VideoPlayer src={node.src} poster={node.poster} controls={node.controls} />
  );
}

export const POPOVER_ITEM_PRESS = 'popover.item.press';

export function renderPopover(
  node: PopoverNode,
  ctx: RenderCtx,
  render: NodeRenderer,
): ReactNode {
  const items: PopoverItemView[] = node.items.map((item) => ({
    id: item.id,
    label: item.label,
    icon: resolveIconName(item.icon),
    danger: item.danger,
    disabled: item.disabled,
    onPress: () => {
      dispatch(
        { type: item.pressType ?? POPOVER_ITEM_PRESS, payload: item.payload },
        ctx,
        { id: item.id },
      );
    },
  }));
  return (
    <Popover
      items={items}
      side={node.side}
      align={node.align}
      dark={ctx.dark}
      trigger={render(node.trigger, ctx)}
    />
  );
}

export function renderVoiceRecorder(
  node: VoiceRecorderNode,
  ctx: RenderCtx,
  render: NodeRenderer,
): ReactNode {
  return (
    <VoiceRecorder
      recording={node.recording}
      levels={node.levels}
      recordSecs={node.recordSecs}
      slideThresholdPx={node.slideToCancel}
      fg={resolveColor(node.fg, ctx.scheme)}
      head={resolveColor(node.head, ctx.scheme)}
      sub={resolveColor(node.sub, ctx.scheme)}
      bg={resolveColor(node.bg, ctx.scheme)}
      chipBg={resolveColor(node.chipBg, ctx.scheme)}
      primary={resolveColor(node.primary, ctx.scheme)}
      dark={ctx.dark}
      inputSlot={render(node.inputSlot, ctx)}
      leftControls={render(node.leftControls, ctx)}
      rightAction={node.rightAction === undefined ? null : render(node.rightAction, ctx)}
      onStart={() => {
        dispatch(node.onStartAction, ctx);
      }}
      onCancel={() => {
        dispatch(node.onCancelAction, ctx);
      }}
      onComplete={() => {
        dispatch(node.onCompleteAction, ctx);
      }}
    />
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
      hitSlop={node.hitSlop}
    >
      {renderList(node.children, ctx, render)}
    </GesturePressable>
  );
}
