import { useRef, useState, type ReactNode } from 'react';
import { Modal as NativeModal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { JsonValue } from '../a2ui/protocol';
import type { SortRect } from '../sortable';
import { asBoolean, asEnum, asOptionalString, asString, commonProps, iconNameOf, type RenderContext } from './a2ui-context';
import { accessibilityProps, weightStyle } from './a2ui-props';
import { useA2uiAction } from './a2ui-renderers.inputs';
import { Icon } from './icon';
import { DROPDOWN_MENU, DropdownMenu, DropdownMenuItem } from './menu';
import { Modal } from './modal';
import { BodyLayer } from './body-layer';
import { Tooltip, TOOLTIP } from './tooltip';
import { TriggerContext } from './trigger-context';

const TIP_WIDTH = 280;
const MENU_GAP = 4;

function measure(node: View | null, done: (rect: SortRect) => void): void {
  node?.measureInWindow((x, y, width, height) => { done({ x, y, width, height }); });
}

function TipAt({ rect, label, dark }: { rect: SortRect; label: string; dark: boolean }): React.ReactElement {
  const below = rect.y < TIP_WIDTH / 4;
  return (
    <BodyLayer
      style={{
        zIndex: 1000, width: TIP_WIDTH, alignItems: 'center',
        left: rect.x + rect.width / 2 - TIP_WIDTH / 2,
        top: below ? rect.y + rect.height + TOOLTIP.gap : rect.y - TOOLTIP.gap,
        transform: below ? undefined : [{ translateY: '-100%' }],
      }}
    >
      <Tooltip label={label} arrow={below ? 'up' : 'down'} dark={dark}/>
    </BodyLayer>
  );
}

function HoverLabel({ label, dark, children }: { label: string; dark: boolean; children: ReactNode }): React.ReactElement {
  const node = useRef<View>(null);
  const [rect, setRect] = useState<SortRect | null>(null);
  return (
    <View ref={node} onPointerEnter={() => { measure(node.current, setRect); }} onPointerLeave={() => { setRect(null); }}>
      {children}
      {rect === null ? null : <TipAt rect={rect} label={label} dark={dark}/>}
    </View>
  );
}

export function withLabelTooltip(ctx: RenderContext, node: ReactNode, show = true): ReactNode {
  const label = ctx.accessibility?.label;
  if (!show || label === undefined || label === '' || Platform.OS !== 'web') return node;
  return <HoverLabel label={label} dark={ctx.dark}>{node}</HoverLabel>;
}

function A2uiModal({ ctx }: { ctx: RenderContext }): React.ReactElement {
  const bound = ctx.instance.open !== undefined;
  const open = ctx.binding<boolean>('open');
  const control = bound
    ? { open: asBoolean(open.value) === true, onOpen: () => { open.set(true); }, onClose: () => { open.set(false); } }
    : {};
  return (
    <Modal {...commonProps(ctx)} {...control} trigger={ctx.child(ctx.props.trigger)} title={asOptionalString(ctx.props.title)}>
      {ctx.child(ctx.props.content)}
    </Modal>
  );
}

interface MenuRow { label: string; icon: ReturnType<typeof iconNameOf>; danger: boolean; action: unknown }

function menuRows(ctx: RenderContext): MenuRow[] {
  const shown = Array.isArray(ctx.props.items) ? ctx.props.items : [];
  const raw: JsonValue[] = Array.isArray(ctx.instance.items) ? ctx.instance.items : [];
  return shown.map((item: unknown, index) => {
    const row = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {};
    const source = raw[index];
    const action = typeof source === 'object' && source !== null && !Array.isArray(source) ? source.action : undefined;
    return { label: asString(row.label), icon: iconNameOf(row.icon), danger: asBoolean(row.danger) === true, action };
  });
}

function MenuRows({ ctx, onClose }: { ctx: RenderContext; onClose: () => void }): React.ReactElement {
  const act = useA2uiAction(ctx);
  return (
    <DropdownMenu dark={ctx.dark}>
      {menuRows(ctx).map((row, index) => {
        const color = row.danger ? ctx.palette.danger : ctx.palette.link;
        return (
          <DropdownMenuItem
            key={index} label={row.label} danger={row.danger} dark={ctx.dark}
            icon={row.icon === undefined ? undefined : <Icon name={row.icon} size={DROPDOWN_MENU.icon} color={color}/>}
            onPress={() => { onClose(); act(row.action); }}
          />
        );
      })}
    </DropdownMenu>
  );
}

function MenuPanel({ ctx, anchor, onClose }: { ctx: RenderContext; anchor: SortRect | null; onClose: () => void }): React.ReactElement {
  const window = useWindowDimensions();
  const end = asEnum(ctx.props.align, ['start', 'end']) === 'end';
  const place = anchor === null ? null : [
    { position: 'absolute' as const, top: anchor.y + anchor.height + MENU_GAP },
    end ? { right: window.width - anchor.x - anchor.width } : { left: anchor.x },
  ];
  return (
    <NativeModal transparent visible={anchor !== null} animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close menu" style={StyleSheet.absoluteFill} onPress={onClose}/>
      {place === null ? null : <View style={place}><MenuRows ctx={ctx} onClose={onClose}/></View>}
    </NativeModal>
  );
}

function A2uiDropdownMenu({ ctx }: { ctx: RenderContext }): React.ReactElement {
  const trigger = useRef<View>(null);
  const [anchor, setAnchor] = useState<SortRect | null>(null);
  const open = (): void => { measure(trigger.current, setAnchor); };
  return (
    <View style={weightStyle(ctx.weight)}>
      <Pressable
        ref={trigger} accessibilityRole="button" {...accessibilityProps(ctx.accessibility)} disabled={ctx.disabled}
        onPress={open}
      >
        <TriggerContext.Provider value={open}>{ctx.child(ctx.props.trigger)}</TriggerContext.Provider>
      </Pressable>
      <MenuPanel ctx={ctx} anchor={anchor} onClose={() => { setAnchor(null); }}/>
    </View>
  );
}

export const OVERLAY_RENDERERS = {
  Modal: (ctx: RenderContext): ReactNode => <A2uiModal ctx={ctx}/>,
  DropdownMenu: (ctx: RenderContext): ReactNode => withLabelTooltip(ctx, <A2uiDropdownMenu ctx={ctx}/>),
};
