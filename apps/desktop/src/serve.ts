import { pathToFileURL } from 'node:url';
import { net, protocol } from 'electron';
import { APP_SCHEME, ISOLATION_HEADERS, mimeFor, webFilePath } from './assets';

export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([{
    scheme: APP_SCHEME,
    privileges: {
      standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true,
      allowServiceWorkers: true,
    },
  }]);
}

function notFound(): Response {
  return new Response('not found', { status: 404, headers: ISOLATION_HEADERS });
}

export function serveWebApp(root: string): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const file = webFilePath(root, new URL(request.url).pathname);
    if (file === null) return notFound();
    const upstream = await net.fetch(pathToFileURL(file).toString());
    if (!upstream.ok) return notFound();
    return new Response(upstream.body, {
      status: 200,
      headers: { ...ISOLATION_HEADERS, 'content-type': mimeFor(file) },
    });
  });
}
