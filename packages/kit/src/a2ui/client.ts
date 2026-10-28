import { createCatalogRegistry, type CatalogRegistry } from './catalog';
import { bump, createAgentCalls, receiveMessage, type Runtime } from './client.messages';
import {
  evaluateChecks, resolveDynamic, safeResolve, toDiagnostic,
  type Diagnostic, type EvalEnv, type Scope,
} from './evaluate';
import { checkedUrl, createBasicFunctions, type FunctionImpl } from './functions';
import { coerceToString, resolveLocale } from './functions.format';
import { KIT_CATALOG, KIT_CATALOG_ID } from './kit-catalog';
import { setAt } from './pointer';
import {
  A2UI_VERSION, BASIC_CATALOG_ID, ERROR_CODES, isEventAction, isFunctionAction, isJsonObject,
  type Action, type CheckRule, type DynamicValue, type EventAction, type JsonObject,
  type JsonValue, type RendererCapabilities, type RendererDataModel, type RendererMessage, type ValidationResult,
} from './protocol';
import { BASIC_CATALOG } from './schemas';
import { parseMessages } from './stream';
import { createSurfaceEvents, type Listener, type SurfaceState } from './surface';

export type SurfaceNav = { kind: 'open'; surfaceId: string } | { kind: 'close' };

export interface TransportMetadata {
  a2uiRendererDataModel: RendererDataModel;
}

export interface ClientDiagnostic extends Diagnostic {
  surfaceId?: string;
}

export interface A2uiClientOptions {
  catalogs?: readonly JsonObject[];
  functions?: Record<string, Record<string, FunctionImpl>>;
  locale?: string;
  openUrl?: (url: string) => void;
  navigate?: (nav: SurfaceNav) => void;
  send?: (message: RendererMessage, metadata?: TransportMetadata) => void;
  onDiagnostic?: (diagnostic: ClientDiagnostic) => void;
  validate?: boolean;
}

export interface DispatchResult {
  ok: boolean;
  error?: string;
}

export interface A2uiClient {
  registry: CatalogRegistry;
  receive: (input: string | JsonValue) => void;
  capabilities: (options?: { inline?: boolean }) => RendererCapabilities;
  surfaceIds: () => string[];
  surface: (surfaceId: string) => SurfaceState | undefined;
  subscribe: (surfaceId: string | null, listener: Listener) => () => void;
  resolve: (surfaceId: string, value: DynamicValue | undefined, scope: Scope) => unknown;
  checks: (surfaceId: string, checks: readonly CheckRule[] | undefined, scope: Scope) => ValidationResult[];
  write: (surfaceId: string, path: string, value: JsonValue | undefined) => void;
  dispatch: (surfaceId: string, sourceComponentId: string, action: Action, scope: Scope) => DispatchResult;
  dataModel: (surfaceId: string) => JsonObject | undefined;
}

function functionTable(options: A2uiClientOptions): Runtime['functions'] {
  const basic = createBasicFunctions(options.locale);
  const { navigate } = options;
  const kit: Record<string, FunctionImpl> = {
    ...basic,
    openSurface: (args) => {
      if (typeof args.surfaceId !== 'string' || args.surfaceId === '') throw new Error('openSurface needs a surfaceId.');
      navigate?.({ kind: 'open', surfaceId: args.surfaceId });
    },
    closeSurface: () => {
      navigate?.({ kind: 'close' });
    },
    equals: (args) => JSON.stringify(args.value ?? null) === JSON.stringify(args.other ?? null),
  };
  const table: Record<string, Record<string, FunctionImpl>> = { [BASIC_CATALOG_ID]: basic, [KIT_CATALOG_ID]: kit };
  for (const [catalogId, fns] of Object.entries(options.functions ?? {})) table[catalogId] = { ...(table[catalogId] ?? {}), ...fns };
  return (catalogId) => table[catalogId];
}

function sendEvent(rt: Runtime, env: EvalEnv, action: EventAction, ids: { surfaceId: string; sourceComponentId: string }, scope: Scope): void {
  const { name, userMessage, context } = action.event;
  const resolved = resolveDynamic(context ?? {}, env, scope, true);
  const message = userMessage === undefined ? undefined : coerceToString(resolveDynamic(userMessage, env, scope, true));
  const event = {
    name,
    ...ids,
    timestamp: new Date().toISOString(),
    context: isJsonObject(resolved) ? resolved : {},
    ...(message === undefined ? {} : { userMessage: message }),
  };
  rt.send({ version: A2UI_VERSION, action: event }, ids.surfaceId);
}

function dispatch(rt: Runtime, surfaceId: string, sourceComponentId: string, action: Action, scope: Scope): DispatchResult {
  const surface = rt.surfaces.get(surfaceId);
  if (surface === undefined) return { ok: false, error: `Surface '${surfaceId}' does not exist.` };
  const env = rt.envFor(surface);
  try {
    if (isEventAction(action)) sendEvent(rt, env, action, { surfaceId, sourceComponentId }, scope);
    else if (isFunctionAction(action)) resolveDynamic(action.functionCall, env, scope, true);
    return { ok: true };
  } catch (error) {
    const diagnostic = toDiagnostic(error);
    rt.diagnose(diagnostic, surfaceId);
    return { ok: false, error: diagnostic.message };
  }
}

export function createA2uiClient(options: A2uiClientOptions = {}): A2uiClient {
  const catalogs = options.catalogs ?? [BASIC_CATALOG, KIT_CATALOG];
  const registry = createCatalogRegistry(catalogs);
  const surfaces = new Map<string, SurfaceState>();
  const events = createSurfaceEvents();
  const functions = functionTable(options);
  const send = (message: RendererMessage, surfaceId?: string): void => {
    const surface = surfaceId === undefined ? undefined : surfaces.get(surfaceId);
    const metadata: TransportMetadata | undefined = surface?.sendDataModel === true ? { a2uiRendererDataModel: { version: A2UI_VERSION, surfaces: { [surface.id]: surface.data } } } : undefined;
    options.send?.(message, metadata);
  };
  const agent = createAgentCalls({ surfaces, send, emit: events.emit });
  const locale = resolveLocale(options.locale);
  const openUrl = options.openUrl ?? ((): void => undefined);
  const rt: Runtime = {
    registry,
    surfaces,
    validate: options.validate !== false,
    functions,
    envFor: (surface) => ({
      catalogId: surface?.catalogId,
      data: surface?.data ?? {},
      registry,
      functions,
      locale,
      openUrl: (url) => {
        openUrl(checkedUrl(url));
      },
      callAgent: agent.callAgent(surface),
    }),
    emit: events.emit,
    send,
    diagnose: (diagnostic, surfaceId) => {
      options.onDiagnostic?.({ ...diagnostic, surfaceId });
    },
    resolveAgentCall: agent.resolveAgentCall,
  };
  return {
    registry,
    receive: (input) => {
      for (const message of parseMessages(input, (text) => { rt.diagnose({ code: ERROR_CODES.validation, message: text }); })) receiveMessage(rt, message);
    },
    capabilities: (opts) => ({
      'v1.0': { supportedCatalogIds: registry.catalogIds(), ...(opts?.inline === true ? { inlineCatalogs: [...catalogs] } : {}) },
    }),
    surfaceIds: () => [...surfaces.keys()],
    surface: (id) => surfaces.get(id),
    subscribe: events.subscribe,
    resolve: (surfaceId, value, scope) => safeResolve(value, rt.envFor(surfaces.get(surfaceId)), scope, (d) => {
      rt.diagnose(d, surfaceId);
    }),
    checks: (surfaceId, checks, scope) => evaluateChecks(checks, rt.envFor(surfaces.get(surfaceId)), scope),
    write: (surfaceId, path, value) => {
      const surface = surfaces.get(surfaceId);
      if (surface === undefined) return;
      surface.data = setAt(surface.data, path, value);
      bump(rt, surface);
    },
    dispatch: (...args) => dispatch(rt, ...args),
    dataModel: (surfaceId) => surfaces.get(surfaceId)?.data,
  };
}
