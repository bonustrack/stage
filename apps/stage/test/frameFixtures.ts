import type { FrameMessage } from '@stage-labs/client/xmtp/frame';
import type { FrameOut } from '../components/frame/frame.model';

export const KIT_CATALOG = 'https://kit.stage.box/a2ui/v1_0/catalog.json';

export function titleMessages(text: string, surfaceId = 'main'): FrameMessage[] {
  return [{ version: 'v1.0', createSurface: { surfaceId, catalogId: KIT_CATALOG, components: [{ id: 'root', component: 'Title', text }] } }];
}

export const REFUSED_MESSAGES: FrameMessage[] = [
  { version: 'v1.0', createSurface: { surfaceId: 'main', catalogId: KIT_CATALOG, components: [{ id: 'root', component: 'Nope' }] } },
];

export function actionOf(name: string, context: Record<string, string | number> = {}) {
  return { name, surfaceId: 'main', sourceComponentId: 'button', timestamp: '2026-10-26T00:00:00.000Z', context };
}

export function tapOf(name: string, context: Record<string, string | number> = {}): FrameOut {
  return { message: { version: 'v1.0', action: actionOf(name, context) } };
}
