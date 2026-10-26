import { createA2uiClient, type A2uiClient, type ClientDiagnostic } from './client';
import { A2UI_VERSION, ROOT_ID, isJsonObject, type AgentMessage } from './protocol';
import { fitsRenderLimits } from './structure';

export interface A2uiSnapshot {
  messages: AgentMessage[];
  surfaceIds: string[];
  diagnostics: ClientDiagnostic[];
  fits: boolean;
}

export function snapshotOfClient(client: A2uiClient): AgentMessage[] {
  return client.surfaceIds().flatMap((surfaceId): AgentMessage[] => {
    const surface = client.surface(surfaceId);
    if (surface?.components.has(ROOT_ID) !== true) return [];
    const createSurface = {
      surfaceId,
      ...(surface.catalogId === undefined ? {} : { catalogId: surface.catalogId }),
      ...(surface.sendDataModel ? { sendDataModel: true } : {}),
      ...(surface.metadata === undefined ? {} : { metadata: surface.metadata }),
      components: [...surface.components.values()],
      ...(Object.keys(surface.data).length === 0 ? {} : { dataModel: surface.data }),
    };
    return [{ version: A2UI_VERSION, createSurface }];
  });
}

export function a2uiSnapshot(messages: readonly unknown[]): A2uiSnapshot {
  const diagnostics: ClientDiagnostic[] = [];
  const client = createA2uiClient({
    send: (message) => {
      if (!('error' in message)) return;
      const { code, message: text, surfaceId, path } = message.error;
      diagnostics.push({ code, message: path === undefined ? text : `${path}: ${text}`, surfaceId });
    },
    onDiagnostic: (diagnostic) => { diagnostics.push(diagnostic); },
  });
  for (const message of messages) if (isJsonObject(message)) client.receive(message);
  const out = snapshotOfClient(client);
  const surfaceIds = out.map((m) => ('createSurface' in m ? m.createSurface.surfaceId : ''));
  const fits = surfaceIds.every((id) => { const surface = client.surface(id); return surface !== undefined && fitsRenderLimits(surface, client.registry); });
  return { messages: out, surfaceIds, diagnostics, fits };
}
