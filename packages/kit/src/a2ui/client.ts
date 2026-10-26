import { createCatalogRegistry, type CatalogRegistry } from './catalog';
import {
  onAgentFunctionResponse, onCallRendererFunction, onCreateSurface, onDeleteSurface,
  onUpdateComponents, onUpdateDataModel, type Runtime,
} from './client.messages';
import { createAgentCalls, type ClientContext } from './client.agent';
import {
  evaluateChecks, resolveDynamic, safeResolve, toDiagnostic,
  type Diagnostic, type EvalEnv, type Scope,
} from './evaluate';
import { checkedUrl, createBasicFunctions, type FunctionImpl } from './functions';
import { createKitFunctions, type SurfaceNav } from './functions.kit';

export type { SurfaceNav } from './functions.kit';
import { coerceToString, resolveLocale } from './functions.format';
import { KIT_CATALOG, KIT_CATALOG_ID } from './kit-catalog';
import { setAt } from './pointer';
import {
  A2UI_VERSION, BASIC_CATALOG_ID, ERROR_CODES, isEventAction, isFunctionAction, isJsonObject,
  type Action, type AgentMessage, type CheckRule, type DynamicValue, type EventAction, type JsonObject,
  type JsonValue, type RendererCapabilities, type RendererDataModel, type RendererMessage, type ValidationResult,
} from './protocol';
import { BASIC_CATALOG } from './schemas';
import { parseMessages } from './stream';
import { createSurfaceEvents, type Listener, type SurfaceState } from './surface';

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

function functionTable(options: A2uiClientOptions): (catalogId: string) => Record<string, FunctionImpl> | undefined {
  const basic = createBasicFunctions(options.locale);
  const kit = { ...basic, ...createKitFunctions(options.navigate) };
  const table: Record<string, Record<string, FunctionImpl>> = { [BASIC_CATALOG_ID]: basic, [KIT_CATALOG_ID]: kit };
  for (const [catalogId, fns] of Object.entries(options.functions ?? {})) table[catalogId] = { ...(table[catalogId] ?? {}), ...fns };
  return (catalogId) => table[catalogId];
}

function dispatchMessage(rt: Runtime, message: AgentMessage): void {
  if ('createSurface' in message) onCreateSurface(rt, message.createSurface);
  else if ('updateComponents' in message) onUpdateComponents(rt, message.updateComponents);
  else if ('updateDataModel' in message) onUpdateDataModel(rt, message.updateDataModel);
  else if ('deleteSurface' in message) onDeleteSurface(rt, message.deleteSurface.surfaceId);
  else if ('callRendererFunction' in message) onCallRendererFunction(rt, message.callRendererFunction);
  else onAgentFunctionResponse(rt, message.agentFunctionResponse);
}

function envelopeSurfaceId(message: JsonValue): string | undefined {
  if (!isJsonObject(message)) return undefined;
  for (const body of Object.values(message)) {
    if (isJsonObject(body) && typeof body.surfaceId === 'string') return body.surfaceId;
  }
  return undefined;
}

function createContext(options: A2uiClientOptions): ClientContext {
  const catalogs = options.catalogs ?? [BASIC_CATALOG, KIT_CATALOG];
  const surfaces = new Map<string, SurfaceState>();
  const metadataFor = (surfaceId: string | undefined): TransportMetadata | undefined => {
    const surface = surfaceId === undefined ? undefined : surfaces.get(surfaceId);
    if (surface?.sendDataModel !== true) return undefined;
    return { a2uiRendererDataModel: { version: A2UI_VERSION, surfaces: { [surface.id]: surface.data } } };
  };
  return {
    catalogs,
    registry: createCatalogRegistry(catalogs),
    events: createSurfaceEvents(),
    surfaces,
    functions: functionTable(options),
    send: (message, surfaceId) => {
      options.send?.(message, metadataFor(surfaceId));
    },
    diagnose: (diagnostic, surfaceId) => {
      options.onDiagnostic?.({ ...diagnostic, surfaceId });
    },
  };
}

function sendEvent(ctx: ClientContext, env: EvalEnv, action: EventAction, ids: { surfaceId: string; sourceComponentId: string }, scope: Scope): void {
  const { name, userMessage, context } = action.event;
  const resolved = resolveDynamic(context ?? {}, env, scope, true);
  const message = userMessage === undefined ? undefined : coerceToString(resolveDynamic(userMessage, env, scope, true));
  const event = {
    name,
    ...ids,
    timestamp: new Date().toISOString(),
    context: (isJsonObject(resolved) ? resolved : {}),
    ...(message === undefined ? {} : { userMessage: message }),
  };
  ctx.send({ version: A2UI_VERSION, action: event }, ids.surfaceId);
}

function makeDispatch(ctx: ClientContext, envFor: (surface: SurfaceState | undefined) => EvalEnv): A2uiClient['dispatch'] {
  return (surfaceId, sourceComponentId, action, scope) => {
    const surface = ctx.surfaces.get(surfaceId);
    if (surface === undefined) return { ok: false, error: `Surface '${surfaceId}' does not exist.` };
    const env = envFor(surface);
    try {
      if (isEventAction(action)) sendEvent(ctx, env, action, { surfaceId, sourceComponentId }, scope);
      else if (isFunctionAction(action)) resolveDynamic(action.functionCall, env, scope, true);
      return { ok: true };
    } catch (error) {
      const diagnostic = toDiagnostic(error);
      ctx.diagnose(diagnostic, surfaceId);
      return { ok: false, error: diagnostic.message };
    }
  };
}

function makeReceiver(ctx: ClientContext, rt: Runtime): (message: JsonValue) => void {
  return (message) => {
    const [issue] = rt.validate ? ctx.registry.validateAgentEnvelope(message) : [];
    if (issue === undefined) {
      dispatchMessage(rt, message as AgentMessage);
      return;
    }
    const surfaceId = envelopeSurfaceId(message);
    if (surfaceId === undefined) ctx.diagnose({ code: ERROR_CODES.validation, message: `${issue.path}: ${issue.message}` });
    else ctx.send({ version: A2UI_VERSION, error: { code: ERROR_CODES.validation, surfaceId, path: issue.path, message: issue.message } }, surfaceId);
  };
}

export function createA2uiClient(options: A2uiClientOptions = {}): A2uiClient {
  const ctx = createContext(options);
  const agent = createAgentCalls(ctx);
  const locale = resolveLocale(options.locale);
  const openUrl = options.openUrl ?? ((): void => undefined);
  const envFor = (surface: SurfaceState | undefined): EvalEnv => ({
    catalogId: surface?.catalogId,
    data: surface?.data ?? {},
    registry: ctx.registry,
    functions: ctx.functions,
    locale,
    openUrl: (url) => {
      openUrl(checkedUrl(url));
    },
    callAgent: agent.callAgent(surface),
  });
  const rt: Runtime = {
    registry: ctx.registry,
    surfaces: ctx.surfaces,
    validate: options.validate !== false,
    functions: ctx.functions,
    envFor,
    emit: ctx.events.emit,
    send: ctx.send,
    diagnose: ctx.diagnose,
    resolveAgentCall: agent.resolveAgentCall,
  };
  const receiveOne = makeReceiver(ctx, rt);
  return {
    registry: ctx.registry,
    receive: (input) => {
      for (const message of parseMessages(input, (text) => { ctx.diagnose({ code: ERROR_CODES.validation, message: text }); })) receiveOne(message);
    },
    capabilities: (opts) => ({
      'v1.0': { supportedCatalogIds: ctx.registry.catalogIds(), ...(opts?.inline === true ? { inlineCatalogs: [...ctx.catalogs] } : {}) },
    }),
    surfaceIds: () => [...ctx.surfaces.keys()],
    surface: (id) => ctx.surfaces.get(id),
    subscribe: ctx.events.subscribe,
    resolve: (surfaceId, value, scope) => safeResolve(value, envFor(ctx.surfaces.get(surfaceId)), scope, (d) => {
      ctx.diagnose(d, surfaceId);
    }),
    checks: (surfaceId, checks, scope) => evaluateChecks(checks, envFor(ctx.surfaces.get(surfaceId)), scope),
    write: (surfaceId, path, value) => {
      const surface = ctx.surfaces.get(surfaceId);
      if (surface === undefined) return;
      surface.data = setAt(surface.data, path, value);
      surface.version += 1;
      ctx.events.emit(surfaceId);
    },
    dispatch: makeDispatch(ctx, envFor),
    dataModel: (surfaceId) => ctx.surfaces.get(surfaceId)?.data,
  };
}
