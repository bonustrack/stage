import { createA2uiClient, type A2uiClient, type ClientDiagnostic } from './client';
import { A2UI_VERSION, ROOT_ID, isJsonObject, type AgentMessage, type JsonObject, type RendererMessage } from './protocol';

export interface A2uiSnapshot {
  messages: AgentMessage[];
  surfaceIds: string[];
  diagnostics: ClientDiagnostic[];
}

function diagnosticOf(message: RendererMessage): ClientDiagnostic | null {
  if (!('error' in message)) return null;
  const { code, message: text, surfaceId, path } = message.error;
  return { code, message: path === undefined ? text : `${path}: ${text}`, surfaceId };
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
      const diagnostic = diagnosticOf(message);
      if (diagnostic !== null) diagnostics.push(diagnostic);
    },
    onDiagnostic: (diagnostic) => { diagnostics.push(diagnostic); },
  });
  for (const message of messages) if (isJsonObject(message)) client.receive(message);
  const out = snapshotOfClient(client);
  return { messages: out, surfaceIds: out.map((m) => ('createSurface' in m ? m.createSurface.surfaceId : '')), diagnostics };
}

export function dataModelUpdates(client: A2uiClient): JsonObject[] {
  return client.surfaceIds().map((surfaceId) => ({
    version: A2UI_VERSION,
    updateDataModel: { surfaceId, path: '/', value: client.dataModel(surfaceId) ?? {} },
  }));
}
