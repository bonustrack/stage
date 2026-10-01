import { Children, useMemo, useState, type ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import {
  FRAME_SPACING_UNIT, frameFillPadding, frameFlex, frameSummary, type FrameColor, type FrameFill, type FrameNode, type FrameNodeOf,
} from '../frame';
import type { FrameBorder, FrameBorderSide } from '../frame.values';
import { spacingEntries, type BoxBaseProps, type ResolvedBoxBorder, type ResolvedBoxBorderSide } from '../layout';
import { BLOCK_RADIUS_DEFAULT, DENSITY_DEFAULT, DENSITY_SCALE } from '../tokens';
import { Box, Col, Row } from './box';
import { Button } from './button';
import { Caption } from './caption';
import { Card } from './card';
import { Divider } from './divider';
import { ListView, ListViewItem } from './list-view';
import { Spacer } from './spacer';
import { Table, TableCell, TableRow } from './table';
import { Text } from './text';
import { FrameFormScope, FrameThemeScope, useFormScope, useFrameColor, useFrameRuntime } from './frame.runtime';

export interface FrameNodeProps<T extends FrameNode['type']> {
  node: FrameNodeOf<T>;
  children?: ReactNode;
  fill?: FrameFill;
}

const FILL_STYLE: ViewStyle = { flexGrow: 1 };

const FILL_CARD_STYLE: ViewStyle = { flexGrow: 1, borderWidth: 0, borderRadius: 0 };

export function FrameFillBox({ fill, children }: { fill: FrameFill; children: ReactNode }): React.ReactElement {
  const { palette } = useFrameRuntime();
  return <Box padding={frameFillPadding(undefined, fill)} background={palette.bg} style={FILL_STYLE}>{children}</Box>;
}

function useFillBackground(background: FrameColor | undefined, fill: FrameFill | undefined): string | undefined {
  const color = useFrameColor();
  const { palette } = useFrameRuntime();
  return color(background) ?? (fill === undefined ? undefined : palette.bg);
}

const CHILD_GAP = DENSITY_SCALE[DENSITY_DEFAULT].gap;

const ROW_GAP = 2 * FRAME_SPACING_UNIT;

function borderSide(side: FrameBorderSide | undefined, color: (c: FrameColor | undefined) => string | undefined, fallback: string): ResolvedBoxBorderSide | undefined {
  if (side === undefined) return undefined;
  return { width: side.width, color: color(side.color) ?? fallback, style: side.style };
}

function resolveBorder(b: FrameBorder | undefined, color: (c: FrameColor | undefined) => string | undefined, fallback: string): ResolvedBoxBorder | undefined {
  if (b === undefined) return undefined;
  return {
    top: borderSide(b.top, color, fallback),
    right: borderSide(b.right, color, fallback),
    bottom: borderSide(b.bottom, color, fallback),
    left: borderSide(b.left, color, fallback),
  };
}

type BoxNode = FrameNodeOf<'Box'> | FrameNodeOf<'Row'> | FrameNodeOf<'Col'> | FrameNodeOf<'Form'>;

function useBoxProps(props: BoxNode['props']): BoxBaseProps {
  const color = useFrameColor();
  const { palette } = useFrameRuntime();
  const { wrap, background, border, ...rest } = props;
  return {
    ...rest,
    wrap: wrap === undefined ? undefined : wrap !== 'nowrap',
    background: color(background),
    border: resolveBorder(border, color, palette.border),
  };
}

export function FrameBox({ node, children }: FrameNodeProps<'Box'>): React.ReactElement {
  return <Box direction={node.props.direction ?? 'col'} {...useBoxProps(node.props)} style={frameFlex(node)}>{children}</Box>;
}

export function FrameRow({ node, children }: FrameNodeProps<'Row'>): React.ReactElement {
  const props = useBoxProps(node.props);
  return <Row {...props} align={props.align ?? 'center'} gap={props.gap ?? ROW_GAP} style={frameFlex(node)}>{children}</Row>;
}

export function FrameCol({ node, children }: FrameNodeProps<'Col'>): React.ReactElement {
  return <Col {...useBoxProps(node.props)} style={frameFlex(node)}>{children}</Col>;
}

function FormMissing(): React.ReactElement | null {
  const scope = useFormScope();
  if (scope === null || scope.missing.length === 0) return null;
  return <Caption color="danger" value={`Required: ${scope.missing.join(', ')}`} />;
}

export function FrameForm({ node, children }: FrameNodeProps<'Form'>): React.ReactElement {
  const props = useBoxProps(node.props);
  return (
    <FrameFormScope submitAction={node.props.onSubmitAction}>
      <Box direction={node.props.direction ?? 'col'} {...props} gap={props.gap ?? CHILD_GAP} style={frameFlex(node)}>
        {children}
        <FormMissing />
      </Box>
    </FrameFormScope>
  );
}

function BasicBody({ node, children, fill }: FrameNodeProps<'Basic'>): React.ReactElement {
  const { direction, gap, align, justify, padding, background } = node.props;
  return (
    <Box direction={direction ?? 'col'} gap={gap} align={align} justify={justify}
      padding={fill === undefined ? padding : frameFillPadding(padding, fill)}
      background={useFillBackground(background, fill)} style={fill === undefined ? undefined : FILL_STYLE}>
      {children}
    </Box>
  );
}

export function FrameBasic({ node, children, fill }: FrameNodeProps<'Basic'>): React.ReactElement {
  return (
    <FrameThemeScope theme={node.props.theme}>
      <BasicBody node={node} fill={fill}>{children}</BasicBody>
    </FrameThemeScope>
  );
}

type CardAction = NonNullable<FrameNodeOf<'Card'>['props']['confirm']>;

function CardFooter({ confirm, cancel, asForm }: { confirm?: CardAction; cancel?: CardAction; asForm: boolean }): React.ReactElement | null {
  const { dark, enabled, busy } = useFrameRuntime();
  const scope = useFormScope();
  if (confirm === undefined && cancel === undefined) return null;
  const off = !enabled || busy;
  return (
    <Row justify="end" gap={8} margin={{ top: 4 }}>
      {cancel ? (
        <Button color="secondary" size="sm" label={cancel.label} dark={dark} disabled={off}
          onPress={() => { void scope?.run(cancel.action, { label: cancel.label }); }} />
      ) : null}
      {confirm ? (
        <Button size="sm" label={confirm.label} dark={dark} disabled={off}
          onPress={() => { void (asForm ? scope?.submit({ label: confirm.label }) : scope?.run(confirm.action, { label: confirm.label })); }} />
      ) : null}
    </Row>
  );
}

function cardStyle(padding: FrameNodeOf<'Card'>['props']['padding'], fill: FrameFill | undefined): ViewStyle {
  const pad = fill === undefined ? padding : frameFillPadding(padding, fill);
  return {
    width: '100%',
    ...(pad === undefined ? {} : spacingEntries('padding', pad)),
    ...(fill === undefined ? {} : FILL_CARD_STYLE),
  };
}

function CardBody({ node, children, fill }: FrameNodeProps<'Card'>): React.ReactElement {
  const { dark } = useFrameRuntime();
  const { size = 'md', padding, background, status, collapsed, confirm, cancel, asForm } = node.props;
  const style = cardStyle(padding, fill);
  return (
    <Card dark={dark} size={size === 'full' ? 'lg' : size} background={useFillBackground(background, fill)}
      status={status === undefined ? undefined : { text: status }} collapsed={collapsed} style={style}>
      <Col gap={CHILD_GAP}>
        {children}
        {asForm === true ? <FormMissing /> : null}
      </Col>
      <CardFooter confirm={confirm} cancel={cancel} asForm={asForm === true} />
    </Card>
  );
}

export function FrameCard({ node, children, fill }: FrameNodeProps<'Card'>): React.ReactElement {
  const body = <CardBody node={node} fill={fill}>{children}</CardBody>;
  return (
    <FrameThemeScope theme={node.props.theme}>
      {node.props.asForm === true ? <FrameFormScope submitAction={node.props.confirm?.action}>{body}</FrameFormScope> : body}
    </FrameThemeScope>
  );
}

function ShowMore({ onPress }: { onPress: () => void }): React.ReactElement {
  const { dark } = useFrameRuntime();
  return (
    <Box padding={{ x: 8, y: 6 }}>
      <Button color="secondary" variant="ghost" size="sm" label="Show more" dark={dark} onPress={onPress} />
    </Box>
  );
}

function ListBody({ node, children }: FrameNodeProps<'ListView'>): React.ReactElement {
  const { dark, palette } = useFrameRuntime();
  const [expanded, setExpanded] = useState(false);
  const count = Children.count(children);
  const limit = expanded ? undefined : node.props.limit;
  const side = { width: 1, color: palette.border };
  return (
    <Box radius={BLOCK_RADIUS_DEFAULT} border={{ top: side, right: side, bottom: side, left: side }} style={{ overflow: 'hidden' }}>
      <ListView dark={dark} limit={limit} status={node.props.status === undefined ? undefined : { text: node.props.status }}>
        {children}
      </ListView>
      {limit !== undefined && count > limit ? <ShowMore onPress={() => { setExpanded(true); }} /> : null}
    </Box>
  );
}

export function FrameListView({ node, children, fill }: FrameNodeProps<'ListView'>): React.ReactElement {
  const body = <ListBody node={node}>{children}</ListBody>;
  return (
    <FrameThemeScope theme={node.props.theme}>
      {fill === undefined ? body : <FrameFillBox fill={fill}>{body}</FrameFillBox>}
    </FrameThemeScope>
  );
}

export function FrameListViewItem({ node, children }: FrameNodeProps<'ListViewItem'>): React.ReactElement {
  const { dark, enabled, busy } = useFrameRuntime();
  const scope = useFormScope();
  const { onClickAction, gap, align } = node.props;
  const pressable = onClickAction !== undefined && enabled && !busy;
  const label = useMemo(() => frameSummary(node).title, [node]);
  return (
    <ListViewItem dark={dark} gap={gap} align={align === 'baseline' || align === 'stretch' ? undefined : align}
      onPress={pressable ? () => { void scope?.run(onClickAction, { label }); } : undefined}>
      {children}
    </ListViewItem>
  );
}

export function FrameSpacer({ node }: FrameNodeProps<'Spacer'>): React.ReactElement {
  return <Spacer minSize={node.props.minSize} />;
}

export function FrameDivider({ node }: FrameNodeProps<'Divider'>): React.ReactElement {
  const { dark } = useFrameRuntime();
  const color = useFrameColor();
  const { size, spacing, flush } = node.props;
  return <Divider dark={dark} size={size} spacing={spacing} flush={flush} color={color(node.props.color)} />;
}

export function FrameTable({ children }: FrameNodeProps<'Table'>): React.ReactElement {
  const { dark } = useFrameRuntime();
  return <Table dark={dark}>{children}</Table>;
}

export function FrameTableRow({ node, children }: FrameNodeProps<'Table.Row'>): React.ReactElement {
  const { dark } = useFrameRuntime();
  return <TableRow dark={dark} header={node.props.header}>{children}</TableRow>;
}

export function FrameTableCell({ node, children }: FrameNodeProps<'Table.Cell'>): React.ReactElement {
  const { width, align, vAlign, colSpan } = node.props;
  return <TableCell width={width} align={align} vAlign={vAlign} colSpan={colSpan}>{children}</TableCell>;
}

export function FrameChart({ node }: FrameNodeProps<'Chart'>): React.ReactElement {
  const { dark } = useFrameRuntime();
  const { header, rows } = node.props;
  return (
    <Table dark={dark}>
      <TableRow dark={dark} header>
        {header.map((h, i) => <TableCell key={i}><Text size="sm" weight="semibold" value={h} /></TableCell>)}
      </TableRow>
      {rows.map((row, r) => (
        <TableRow key={r} dark={dark}>
          {row.map((v, i) => <TableCell key={i}><Text size="sm" value={v} /></TableCell>)}
        </TableRow>
      ))}
    </Table>
  );
}

export function FrameTransition({ children }: FrameNodeProps<'Transition'>): React.ReactElement {
  return <>{children}</>;
}

export function FrameUnsupported({ node }: FrameNodeProps<'Unsupported'>): React.ReactElement {
  const { palette } = useFrameRuntime();
  const side = { width: 1, color: palette.border, style: 'dashed' };
  const name = node.props.name;
  return (
    <Box padding={8} radius="sm" border={{ top: side, right: side, bottom: side, left: side }}>
      <Caption value={name === '' ? 'Unsupported content' : `Unsupported: ${name}`} />
    </Box>
  );
}

