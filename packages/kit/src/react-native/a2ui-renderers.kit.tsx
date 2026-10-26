import type { ReactNode } from 'react';
import type { BadgeColor, BadgeSize, BadgeVariant } from '../badge';
import { Badge } from './badge';
import { ListView, ListViewItem } from './list-view';
import { QrCode } from './qr-code';
import { Spinner } from './spinner';
import { Title } from './title';
import {
  asBoolean, asEnum, asNumber, asOptionalString, asString,
  colorOf, commonProps, type A2uiRenderers, type RenderContext,
} from './a2ui-context';

const BADGE_COLORS = ['secondary', 'success', 'danger', 'warning', 'info', 'discovery'] as const satisfies readonly BadgeColor[];
const BADGE_SIZES = ['3xs', '2xs', 'sm', 'md', 'lg'] as const satisfies readonly BadgeSize[];
const BADGE_VARIANTS = ['solid', 'soft', 'outline'] as const satisfies readonly BadgeVariant[];

function titleRenderer(ctx: RenderContext): ReactNode {
  const level = asNumber(ctx.props.level);
  return (
    <Title
      {...commonProps(ctx)}
      text={asString(ctx.props.text)}
      level={level === 1 || level === 2 || level === 3 ? level : undefined}
      size={asEnum(ctx.props.size, ['sm', 'md', 'lg'])}
      color={colorOf(ctx, ctx.props.color)}
    />
  );
}

function listViewItemRenderer(ctx: RenderContext): ReactNode {
  const pressable = ctx.instance.action !== undefined && !ctx.disabled;
  return (
    <ListViewItem
      {...commonProps(ctx)}
      dark={ctx.dark}
      gap={asNumber(ctx.props.gap)}
      align={asEnum(ctx.props.align, ['start', 'center', 'end'])}
      onPress={pressable ? () => { ctx.action(); } : undefined}
    >
      {ctx.children(ctx.props.children)}
    </ListViewItem>
  );
}

export const KIT_EXTRA_RENDERERS: A2uiRenderers = {
  Title: titleRenderer,
  Badge: (ctx) => (
    <Badge
      {...commonProps(ctx)}
      label={asString(ctx.props.label)}
      color={asEnum(ctx.props.color, BADGE_COLORS)}
      variant={asEnum(ctx.props.variant, BADGE_VARIANTS)}
      size={asEnum(ctx.props.size, BADGE_SIZES)}
      pill={asBoolean(ctx.props.pill)}
    />
  ),
  ListView: (ctx) => {
    const status = asOptionalString(ctx.props.status);
    return (
      <ListView {...commonProps(ctx)} dark={ctx.dark} limit={asNumber(ctx.props.limit)} status={status === undefined ? undefined : { text: status }}>
        {ctx.children(ctx.props.children)}
      </ListView>
    );
  },
  ListViewItem: listViewItemRenderer,
  Spinner: (ctx) => <Spinner {...commonProps(ctx)} size={asNumber(ctx.props.size)} color={colorOf(ctx, ctx.props.color) ?? ctx.palette.sub} />,
  QrCode: (ctx) => <QrCode {...commonProps(ctx)} value={asString(ctx.props.value)} size={asNumber(ctx.props.size)} color={ctx.palette.link} background={ctx.palette.bg} />,
};
