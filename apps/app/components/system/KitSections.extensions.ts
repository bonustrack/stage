
import type { WidgetRoot } from '@stage-labs/kit/kit';

const SAMPLE_IMAGE =
  'https://cdn.stamp.fyi/avatar/eth:0x2539f6dd5e4ab2c3a30c2b9a0a8a8a8a8a8a79d5?s=160';

export const EXTENSION_WIDGET: WidgetRoot = {
  type: 'Basic',
  children: [
    { type: 'Title', value: 'Hero', size: '7xl' },
    { type: 'Spacer', minSize: 8 },
    {
      type: 'Row',
      gap: 16,
      align: 'center',
      children: [
        { type: 'Spinner', size: 'sm' },
        { type: 'Spinner', size: 'md' },
        { type: 'Spinner', size: 'lg', color: '#2f6df6' },
      ],
    },
    { type: 'Spacer', minSize: 12 },
    {
      type: 'Switch',
      name: 'demoSwitch',
      checked: true,
      label: 'Notifications',
      onChangeAction: { type: 'demo_switch', handler: 'client' },
    },
    { type: 'Spacer', minSize: 12 },
    {
      type: 'Tabs',
      name: 'demoTabs',
      value: 'overview',
      onChangeAction: { type: 'demo_tabs', handler: 'client' },
      options: [
        { value: 'overview', label: 'Overview', icon: 'wallet' },
        { value: 'activity', label: 'Activity', icon: 'bell' },
        { value: 'settings', label: 'Settings', icon: 'cog' },
      ],
    },
    { type: 'Spacer', minSize: 12 },
    {
      type: 'AvatarStack',
      size: 36,
      max: 4,
      items: [
        { src: SAMPLE_IMAGE },
        { src: SAMPLE_IMAGE },
        { fallback: 'AB' },
        { fallback: 'CD' },
        { fallback: 'EF' },
        { fallback: 'GH' },
      ],
    },
    { type: 'Spacer', minSize: 12 },
    { type: 'QRCode', value: 'https://metro.box', size: 140 },
    { type: 'Spacer', minSize: 12 },
    {
      type: 'TextField',
      name: 'demoField',
      value: 'live text',
      placeholder: 'Type here',
      onChangeAction: { type: 'demo_text', handler: 'client' },
      onSelectionChangeAction: { type: 'demo_selection', handler: 'client' },
    },
    { type: 'Spacer', minSize: 12 },
    {
      type: 'Stack',
      width: '100%',
      height: 28,
      children: [
        {
          type: 'Box',
          position: 'absolute',
          inset: 0,
          radius: 'sm',
          background: { dark: '#1c2a4a', light: '#dbe5ff' },
        },
        {
          type: 'Box',
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: '62%',
          radius: 'sm',
          background: '#2f6df6',
        },
        {
          type: 'Box',
          position: 'absolute',
          inset: 0,
          align: 'center',
          justify: 'center',
          children: [
            { type: 'Text', value: '62%', weight: 'semibold', color: '#ffffff' },
          ],
        },
      ],
    },
    { type: 'Spacer', minSize: 12 },
    {
      type: 'ScrollRow',
      gap: 8,
      padding: { y: 4 },
      children: [
        { type: 'Badge', label: 'All', pill: true },
        { type: 'Badge', label: 'DeFi', pill: true, color: 'info' },
        { type: 'Badge', label: 'NFTs', pill: true, color: 'discovery' },
        { type: 'Badge', label: 'Governance', pill: true, color: 'success' },
        { type: 'Badge', label: 'Social', pill: true, color: 'warning' },
        { type: 'Badge', label: 'Gaming', pill: true, color: 'danger' },
      ],
    },
    { type: 'Spacer', minSize: 12 },
    {
      type: 'ColorPicker',
      name: 'demoColor',
      value: '#2f6df6',
      onChangeAction: { type: 'demo_color', handler: 'client' },
    },
    { type: 'Spacer', minSize: 12 },
    {
      type: 'Button',
      label: 'Custom color button',
      color: '#8b5cf6',
      onClickAction: { type: 'demo_button', handler: 'client' },
    },
    { type: 'Spacer', minSize: 12 },
    {
      type: 'Pressable',
      onClickAction: { type: 'demo_press', handler: 'client' },
      onLongPressAction: { type: 'demo_longpress', handler: 'client' },
      onSwipeAction: { type: 'demo_swipe', handler: 'client' },
      children: [
        {
          type: 'Box',
          padding: { x: 12, y: 10 },
          radius: 'sm',
          background: { dark: '#1c1c1e', light: '#f0f0f2' },
          children: [{ type: 'Text', value: 'Tap, long-press, or swipe me' }],
        },
      ],
    },
    { type: 'Spacer', minSize: 12 },
    {
      type: 'AudioPlayer',
      src: 'https://cdn.metro.box/sample.mp3',
      duration: 42,
      onPlayAction: { type: 'demo_audio', handler: 'client' },
    },
    { type: 'Spacer', minSize: 12 },
    {
      type: 'VideoPlayer',
      src: 'https://cdn.metro.box/sample.mp4',
      controls: true,
    },
  ],
};
