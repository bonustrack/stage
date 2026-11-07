const realFetch = globalThis.fetch;

function requestOf(input: RequestInfo | URL, init?: RequestInit): Request {
  return input instanceof Request ? new Request(input, init) : new Request(String(input), init);
}

export function fakeFetch(answer: (request: Request, init?: RequestInit) => Response | Promise<Response>): typeof fetch {
  return Object.assign(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => answer(requestOf(input, init), init), {
    preconnect: realFetch.preconnect,
  });
}

export function stubFetch(answer: (request: Request, init?: RequestInit) => Response | Promise<Response>): void {
  globalThis.fetch = fakeFetch(answer);
}

export function restoreFetch(): void {
  globalThis.fetch = realFetch;
}
