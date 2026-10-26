import { useEffect, useMemo, useRef } from 'react';
import { createA2uiClient, type A2uiClient, type A2uiClientOptions, type TransportMetadata } from '../a2ui/client';
import { isJsonObject, type RendererMessage } from '../a2ui/protocol';

export interface A2uiSessionOptions extends Omit<A2uiClientOptions, 'send'> {
  send?: (message: RendererMessage, client: A2uiClient, metadata?: TransportMetadata) => void;
}

export function useA2uiClient(messages: readonly unknown[], options: A2uiSessionOptions = {}): A2uiClient {
  const latest = useRef(options);
  useEffect(() => { latest.current = options; });
  return useMemo(() => {
    const client: A2uiClient = createA2uiClient({
      catalogs: latest.current.catalogs,
      functions: latest.current.functions,
      locale: latest.current.locale,
      validate: latest.current.validate,
      openUrl: (url) => { latest.current.openUrl?.(url); },
      navigate: (nav) => { latest.current.navigate?.(nav); },
      send: (message, metadata) => { latest.current.send?.(message, client, metadata); },
      onDiagnostic: (diagnostic) => { latest.current.onDiagnostic?.(diagnostic); },
    });
    for (const message of messages) if (isJsonObject(message)) client.receive(message);
    return client;
  }, [messages]);
}
