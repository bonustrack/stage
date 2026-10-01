import { Component, useMemo, type ComponentType, type ReactNode } from 'react';
import { parseFrame, type FrameError, type FrameFill, type FrameNode, type FrameNodeOf } from '../frame';
import { frameChildFlow } from '../frame.flow';
import { kitPalette } from '../tokens';
import { Box } from './box';
import { Caption } from './caption';
import { KitThemeProvider, useKitScheme } from './theme-context';
import {
  FrameBasic, FrameBox, FrameCard, FrameChart, FrameCol, FrameDivider, FrameFillBox, FrameForm, FrameListView,
  FrameListViewItem, FrameRow, FrameSpacer, FrameTable, FrameTableCell, FrameTableRow, FrameTransition,
  FrameUnsupported,
} from './frame.layout';
import {
  FrameBadge, FrameButton, FrameCaption, FrameIcon, FrameImage, FrameLabel, FrameMarkdown, FrameText, FrameTitle,
} from './frame.content';
import {
  FrameCheckbox, FrameDatePicker, FrameInput, FrameRadioGroup, FrameSelect, FrameTextarea,
} from './frame.controls';
import {
  FrameFlowProvider, FrameFormScope, FrameRuntimeProvider, useFrameFlow, useFrameRuntime, type FrameActionHandler,
} from './frame.runtime';

export type { FrameActionHandler, FrameActionSource } from './frame.runtime';
export type { FrameAction, FrameFill } from '../frame';

type NodeRenderers = {
  [T in FrameNode['type']]: ComponentType<{ node: FrameNodeOf<T>; children?: ReactNode; fill?: FrameFill }>
};

const RENDERERS: NodeRenderers = {
  Card: FrameCard, ListView: FrameListView, ListViewItem: FrameListViewItem, Basic: FrameBasic,
  Box: FrameBox, Row: FrameRow, Col: FrameCol, Form: FrameForm, Transition: FrameTransition,
  Text: FrameText, Title: FrameTitle, Caption: FrameCaption, Label: FrameLabel, Markdown: FrameMarkdown,
  Badge: FrameBadge, Icon: FrameIcon, Image: FrameImage, Button: FrameButton, Spacer: FrameSpacer,
  Divider: FrameDivider, Input: FrameInput, Textarea: FrameTextarea, Select: FrameSelect,
  DatePicker: FrameDatePicker, Checkbox: FrameCheckbox, RadioGroup: FrameRadioGroup, Table: FrameTable,
  'Table.Row': FrameTableRow, 'Table.Cell': FrameTableCell, Chart: FrameChart, Unsupported: FrameUnsupported,
};

function FrameNodeView({ node, fill }: { node: FrameNode; fill?: FrameFill }): React.ReactElement {
  const Render = RENDERERS[node.type] as ComponentType<{ node: FrameNode; children?: ReactNode; fill?: FrameFill }>;
  const parent = useFrameFlow();
  const flow = useMemo(() => frameChildFlow(node, parent), [node, parent]);
  if (node.children.length === 0) return <Render node={node} fill={fill} />;
  const kids = node.children.map((child, i) => <FrameNodeView key={i} node={child} />);
  return <Render node={node} fill={fill}>{flow === undefined ? kids : <FrameFlowProvider value={flow}>{kids}</FrameFlowProvider>}</Render>;
}

const FILL_ROOTS = new Set<FrameNode['type']>(['Card', 'ListView', 'Basic']);

function Filled({ fill, children }: { fill?: FrameFill; children: ReactNode }): React.ReactElement {
  return fill === undefined ? <>{children}</> : <FrameFillBox fill={fill}>{children}</FrameFillBox>;
}

function FrameRoot({ node, fill }: { node: FrameNode; fill?: FrameFill }): React.ReactElement {
  if (fill === undefined || FILL_ROOTS.has(node.type)) return <FrameNodeView node={node} fill={fill} />;
  return <FrameFillBox fill={fill}><FrameNodeView node={node} /></FrameFillBox>;
}

const NOTICE: Record<FrameError | 'render', string> = {
  invalid: 'This frame could not be read.',
  'too-large': 'This frame is too large to show.',
  'too-deep': 'This frame is too complex to show.',
  'too-many-nodes': 'This frame is too complex to show.',
  render: 'This frame could not be shown.',
};

function FrameNotice({ reason }: { reason: FrameError | 'render' }): React.ReactElement {
  const { palette } = useFrameRuntime();
  const side = { width: 1, color: palette.border };
  return (
    <Box padding={12} radius="lg" border={{ top: side, right: side, bottom: side, left: side }}>
      <Caption value={NOTICE[reason]} />
    </Box>
  );
}

class FrameBoundary extends Component<{ resetKey: unknown; fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidUpdate(prev: { resetKey: unknown }): void {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface FrameProps {
  widget: unknown;
  dark?: boolean;
  onAction?: FrameActionHandler;
  onOpenUrl?: (url: string) => void;
  disabled?: boolean;
  fill?: FrameFill;
}

function FrameBody({ widget, fill }: { widget: unknown; fill?: FrameFill }): React.ReactElement {
  const parsed = useMemo(() => parseFrame(widget), [widget]);
  if (!parsed.ok) return <Filled fill={fill}><FrameNotice reason={parsed.error} /></Filled>;
  return (
    <FrameBoundary resetKey={parsed} fallback={<Filled fill={fill}><FrameNotice reason="render" /></Filled>}>
      <FrameFormScope>
        <FrameRoot node={parsed.root} fill={fill} />
      </FrameFormScope>
    </FrameBoundary>
  );
}

export function Frame({ widget, dark, onAction, onOpenUrl, disabled, fill }: FrameProps): React.ReactElement {
  const contextScheme = useKitScheme();
  const scheme = dark === undefined ? contextScheme : dark ? 'dark' : 'light';
  const body = (
    <FrameRuntimeProvider dark={scheme === 'dark'} onAction={onAction} onOpenUrl={onOpenUrl} disabled={disabled}>
      <FrameBody widget={widget} fill={fill} />
    </FrameRuntimeProvider>
  );
  if (scheme === contextScheme) return body;
  return <KitThemeProvider value={kitPalette(scheme)} scheme={scheme}>{body}</KitThemeProvider>;
}
