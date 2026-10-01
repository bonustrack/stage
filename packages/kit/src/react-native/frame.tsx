import { Component, useCallback, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  navigateFrame, parseFrameDoc, type FrameDocResult, type FrameError, type FrameFill, type FrameNav, type FrameNode,
  type FrameNodeOf,
} from '../frame';
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
export type { FrameAction, FrameFill, FrameNav } from '../frame';

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

type NoticeReason = FrameError | 'render' | 'no-screen';

const NOTICE: Record<NoticeReason, string> = {
  invalid: 'This frame could not be read.',
  'too-large': 'This frame is too large to show.',
  'too-deep': 'This frame is too complex to show.',
  'too-many-nodes': 'This frame is too complex to show.',
  'too-many-screens': 'This frame has too many screens to show.',
  render: 'This frame could not be shown.',
  'no-screen': 'This screen is not in the frame.',
};

function FrameNotice({ reason }: { reason: NoticeReason }): React.ReactElement {
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

export interface FrameNavigation {
  screen: string;
  depth: number;
  navigate: (nav: FrameNav) => void;
}

export function useFrameNavigation(start: string): FrameNavigation {
  const [state, setState] = useState<{ start: string; stack: readonly string[] }>({ start, stack: [start] });
  const stack = state.start === start ? state.stack : [start];
  const navigate = useCallback((nav: FrameNav): void => {
    setState((prev) => ({ start, stack: navigateFrame(prev.start === start ? prev.stack : [start], nav) }));
  }, [start]);
  return { screen: stack[stack.length - 1] ?? start, depth: stack.length - 1, navigate };
}

export interface FrameProps {
  widget: unknown;
  dark?: boolean;
  onAction?: FrameActionHandler;
  onOpenUrl?: (url: string) => void;
  disabled?: boolean;
  fill?: FrameFill;
  navigation?: FrameNavigation;
}

function FrameBody({ parsed, screen, fill }: { parsed: FrameDocResult; screen: string; fill?: FrameFill }): React.ReactElement {
  const root = parsed.ok ? parsed.doc.screens.get(screen)?.root : undefined;
  if (root === undefined) return <Filled fill={fill}><FrameNotice reason={parsed.ok ? 'no-screen' : parsed.error} /></Filled>;
  return (
    <FrameBoundary resetKey={root} fallback={<Filled fill={fill}><FrameNotice reason="render" /></Filled>}>
      <FrameFormScope key={screen}>
        <FrameRoot node={root} fill={fill} />
      </FrameFormScope>
    </FrameBoundary>
  );
}

export function Frame({ widget, dark, onAction, onOpenUrl, disabled, fill, navigation }: FrameProps): React.ReactElement {
  const contextScheme = useKitScheme();
  const scheme = dark === undefined ? contextScheme : dark ? 'dark' : 'light';
  const parsed = useMemo(() => parseFrameDoc(widget), [widget]);
  const own = useFrameNavigation(parsed.ok ? parsed.doc.start : '');
  const nav = navigation ?? own;
  const screen = parsed.ok && parsed.doc.multi ? nav.screen : undefined;
  const body = (
    <FrameRuntimeProvider dark={scheme === 'dark'} onAction={onAction} onOpenUrl={onOpenUrl} disabled={disabled}
      navigate={nav.navigate} screen={screen}>
      <FrameBody parsed={parsed} screen={nav.screen} fill={fill} />
    </FrameRuntimeProvider>
  );
  if (scheme === contextScheme) return body;
  return <KitThemeProvider value={kitPalette(scheme)} scheme={scheme}>{body}</KitThemeProvider>;
}
