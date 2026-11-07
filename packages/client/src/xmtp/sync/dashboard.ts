import { z } from 'zod';
import { frameSourceSchema } from '../frame.schema';
import { defineSyncKind, latestWins } from './kind';

export const DASHBOARD_WIDTHS = ['full', 'half', 'quarter'] as const;

export type DashboardWidth = (typeof DASHBOARD_WIDTHS)[number];

export const DASHBOARD_HEIGHTS = [1, 2, 3, 4] as const;

export type DashboardHeight = (typeof DASHBOARD_HEIGHTS)[number];

export const DASHBOARD_MAX_WIDGETS = 48;

function isDashboardHeight(h: number): h is DashboardHeight {
  return DASHBOARD_HEIGHTS.some((height) => height === h);
}

const dashboardSourceSchema = z.object({ conversationId: z.string().min(1).max(128), messageId: z.string().min(1).max(128) });

export type DashboardSource = z.infer<typeof dashboardSourceSchema>;

export const DASHBOARD_FRAME_KIND = 'frame';

export const DASHBOARD_LIVE_KIND = 'live';

const widgetFields = { id: z.string().min(1).max(64), w: z.enum(DASHBOARD_WIDTHS), h: z.number().refine(isDashboardHeight) };

const frameWidgetSchema = z.object({ ...widgetFields, kind: z.literal(DASHBOARD_FRAME_KIND), source: dashboardSourceSchema });

const liveWidgetSchema = z.object({
  ...widgetFields,
  kind: z.literal(DASHBOARD_LIVE_KIND),
  source: frameSourceSchema,
  key: z.string().regex(/^[0-9a-f]{64}$/),
  origin: dashboardSourceSchema.optional(),
});

const dashboardWidgetSchema = z.discriminatedUnion('kind', [frameWidgetSchema, liveWidgetSchema]);

export type DashboardWidget = z.infer<typeof dashboardWidgetSchema>;

type LiveDashboardWidget = z.infer<typeof liveWidgetSchema>;

export interface LiveSource {
  url: string;
  key: string;
  origin?: DashboardSource;
}

export function liveSourceOf(widget: LiveDashboardWidget): LiveSource {
  const { source, key, origin } = widget;
  return origin === undefined ? { url: source.url, key } : { url: source.url, key, origin };
}

function validWidgets(items: readonly unknown[]): DashboardWidget[] {
  const ids = new Set<string>();
  const widgets: DashboardWidget[] = [];
  for (const item of items) {
    const parsed = dashboardWidgetSchema.safeParse(item);
    if (!parsed.success || ids.has(parsed.data.id) || widgets.length === DASHBOARD_MAX_WIDGETS) continue;
    ids.add(parsed.data.id);
    widgets.push(parsed.data);
  }
  return widgets;
}

export const dashboardSchema = z.object({ widgets: z.array(z.unknown()).transform(validWidgets), at: z.number().nonnegative() });

export type DashboardContent = z.infer<typeof dashboardSchema>;

export const EMPTY_DASHBOARD: DashboardContent = { widgets: [], at: 0 };

export const DASHBOARD_SYNC = defineSyncKind({
  typeId: 'dashboardLayout',
  schema: dashboardSchema,
  fallback: 'Stage dashboard',
  replay: latestWins<DashboardContent>(),
});
