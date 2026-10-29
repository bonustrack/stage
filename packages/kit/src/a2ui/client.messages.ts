import type { CatalogRegistry } from './catalog';
import { resolveDynamic, ROOT_SCOPE, toDiagnostic, type Diagnostic, type EvalEnv } from './evaluate';
import type { FunctionImpl } from './functions';
import { setAt } from './pointer';
import {
  A2UI_VERSION,
  ERROR_CODES,
  isJsonObject,
  type AgentMessage,
  type CallRendererFunction,
  type ComponentInstance,
  type CreateSurface,
  type FunctionResponse,
  type JsonObject,
  type JsonValue,
  type RendererError,
  type RendererMessage,
  type UpdateComponents,
  type UpdateDataModel,
} from './protocol';
import { compositionIssues } from './structure';
import type { SurfaceState } from './surface';

export interface Runtime {
  registry: CatalogRegistry;
  surfaces: Map<string, SurfaceState>;
  validate: boolean;
  functions: (catalogId: string) => Record<string, FunctionImpl> | undefined;
  envFor: (surface: SurfaceState | undefined) => EvalEnv;
  emit: (surfaceId: string) => void;
  send: (message: RendererMessage, surfaceId?: string) => void;
  diagnose: (diagnostic: Diagnostic, surfaceId?: string) => void;
  resolveAgentCall: (response: FunctionResponse) => void;
}

function sendError(rt: Runtime, error: RendererError): void {
  rt.send({ version: A2UI_VERSION, error }, error.surfaceId);
}

export function bump(rt: Pick<Runtime, 'emit'>, surface: SurfaceState): void {
  surface.version += 1;
  rt.emit(surface.id);
}

function acceptComponent(rt: Runtime, surface: SurfaceState, component: ComponentInstance, path: string[]): boolean {
  if (!rt.validate) return true;
  const catalogId = component.catalogId ?? surface.catalogId;
  const [first] =
    catalogId === undefined
      ? [{ path: `/${path.join('/')}/catalogId`, message: `Component '${component.id}' has no catalog to resolve against.` }]
      : rt.registry.validateComponent(catalogId, component, path);
  if (first === undefined) return true;
  sendError(rt, { code: ERROR_CODES.validation, surfaceId: surface.id, path: first.path, message: first.message });
  return false;
}

function applyComponents(rt: Runtime, surface: SurfaceState, components: readonly ComponentInstance[], base: string[]): void {
  components.forEach((component, index) => {
    if (acceptComponent(rt, surface, component, [...base, String(index)])) surface.components.set(component.id, component);
  });
  for (const found of compositionIssues(surface.components, rt.registry, surface.catalogId)) {
    const key = `${found.code}:${found.componentId}:${found.message}`;
    if (surface.reported.has(key)) continue;
    surface.reported.add(key);
    sendError(rt, { code: found.code, surfaceId: surface.id, path: `/components/${found.componentId}`, message: found.message });
  }
}

function onCreateSurface(rt: Runtime, msg: CreateSurface): void {
  const { surfaceId, catalogId } = msg;
  if (rt.surfaces.has(surfaceId)) {
    sendError(rt, {
      code: ERROR_CODES.integrity,
      surfaceId,
      message: `Surface '${surfaceId}' already exists. Delete it before creating it again.`,
    });
    return;
  }
  if (catalogId !== undefined && rt.registry.catalog(catalogId) === undefined) {
    sendError(rt, {
      code: ERROR_CODES.unsupportedCatalog,
      surfaceId,
      message: `Catalog '${catalogId}' is not supported by this renderer.`,
    });
    return;
  }
  const surface: SurfaceState = {
    id: surfaceId,
    catalogId,
    sendDataModel: msg.sendDataModel === true,
    metadata: isJsonObject(msg.metadata) ? msg.metadata : undefined,
    components: new Map(),
    data: isJsonObject(msg.dataModel) ? msg.dataModel : {},
    version: 0,
    agentCalls: new Map(),
    reported: new Set(),
  };
  rt.surfaces.set(surfaceId, surface);
  if (msg.components !== undefined) applyComponents(rt, surface, msg.components, ['createSurface', 'components']);
  bump(rt, surface);
}

function requireSurface(rt: Runtime, surfaceId: string): SurfaceState | undefined {
  const surface = rt.surfaces.get(surfaceId);
  if (surface === undefined)
    sendError(rt, { code: ERROR_CODES.integrity, surfaceId, message: `Surface '${surfaceId}' does not exist. Send createSurface first.` });
  return surface;
}

function onUpdateComponents(rt: Runtime, msg: UpdateComponents): void {
  const surface = requireSurface(rt, msg.surfaceId);
  if (surface === undefined) return;
  applyComponents(rt, surface, msg.components, ['updateComponents', 'components']);
  bump(rt, surface);
}

function onUpdateDataModel(rt: Runtime, msg: UpdateDataModel): void {
  const surface = requireSurface(rt, msg.surfaceId);
  if (surface === undefined) return;
  surface.data = setAt(surface.data, msg.path ?? '/', msg.value ?? undefined);
  bump(rt, surface);
}

function permissionError(call: CallRendererFunction, rt: Runtime): string | undefined {
  const fn = call.callFunction;
  const name = fn['@call'];
  if (rt.registry.catalog(fn.catalogId) === undefined) return `Catalog '${fn.catalogId}' is not registered.`;
  const meta = rt.registry.functionMeta(fn.catalogId, name);
  if (meta === undefined) return `Function '${name}' is not defined in catalog '${fn.catalogId}'.`;
  if (meta.allowedCallers === 'rendererOnly') return `Function '${name}' cannot be called by agent (allowedCallers is rendererOnly).`;
  if (meta.requiresUserActivation) return `Function '${name}' requires a user gesture.`;
  return undefined;
}

function rendererCallError(call: CallRendererFunction, rt: Runtime): string | undefined {
  const denied = permissionError(call, rt);
  if (denied !== undefined) return denied;
  const fn = call.callFunction;
  if (call.surfaceId !== undefined && !rt.surfaces.has(call.surfaceId)) return `Surface '${call.surfaceId}' does not exist.`;
  if (rt.functions(fn.catalogId)?.[fn['@call']] === undefined) return `Function '${fn['@call']}' is not implemented by this renderer.`;
  const [issue] = rt.validate ? rt.registry.validateFunctionCall(fn.catalogId, fn, ['callRendererFunction', 'callFunction']) : [];
  return issue === undefined ? undefined : `${issue.path}: ${issue.message}`;
}

function onCallRendererFunction(rt: Runtime, call: CallRendererFunction): void {
  const { functionCallId, callFunction } = call;
  const respond = (response: Omit<FunctionResponse, 'functionCallId'>): void => {
    rt.send({ version: A2UI_VERSION, rendererFunctionResponse: { functionCallId, ...response } });
  };
  const invalid = rendererCallError(call, rt);
  if (invalid !== undefined) {
    respond({ error: { code: ERROR_CODES.invalidFunctionCall, message: invalid } });
    return;
  }
  const env = rt.envFor(call.surfaceId === undefined ? undefined : rt.surfaces.get(call.surfaceId));
  const settle = (value: unknown): void => {
    respond({ value: (value ?? null) as JsonValue });
  };
  const fail = (error: unknown): void => {
    respond({ error: { code: ERROR_CODES.execution, message: toDiagnostic(error).message } });
  };
  try {
    const result = resolveDynamic(callFunction, { ...env, catalogId: callFunction.catalogId }, ROOT_SCOPE);
    if (result instanceof Promise) result.then(settle, fail);
    else settle(result);
  } catch (error) {
    fail(error);
  }
}

function dispatchMessage(rt: Runtime, message: AgentMessage): void {
  if ('createSurface' in message) onCreateSurface(rt, message.createSurface);
  else if ('updateComponents' in message) onUpdateComponents(rt, message.updateComponents);
  else if ('updateDataModel' in message) onUpdateDataModel(rt, message.updateDataModel);
  else if ('deleteSurface' in message) {
    if (rt.surfaces.delete(message.deleteSurface.surfaceId)) rt.emit(message.deleteSurface.surfaceId);
  } else if ('callRendererFunction' in message) onCallRendererFunction(rt, message.callRendererFunction);
  else if ('agentFunctionResponse' in message) rt.resolveAgentCall(message.agentFunctionResponse);
  else rt.diagnose({ code: ERROR_CODES.validation, message: 'Unknown A2UI message.' });
}

export function receiveMessage(rt: Runtime, message: JsonValue): void {
  const [issue] = rt.validate ? rt.registry.validateAgentEnvelope(message) : [];
  if (issue === undefined) {
    try {
      dispatchMessage(rt, message as AgentMessage);
    } catch (error) {
      rt.diagnose({ code: ERROR_CODES.validation, message: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  const body = isJsonObject(message)
    ? Object.values(message).find((value) => isJsonObject(value) && typeof value.surfaceId === 'string')
    : undefined;
  const surfaceId = isJsonObject(body) ? body.surfaceId : undefined;
  if (typeof surfaceId === 'string') sendError(rt, { code: ERROR_CODES.validation, surfaceId, path: issue.path, message: issue.message });
  else rt.diagnose({ code: ERROR_CODES.validation, message: `${issue.path}: ${issue.message}` });
}

function stableKey(value: JsonValue | Record<string, unknown>): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((v) => stableKey(v)).join(',')}]`;
  const record: Record<string, unknown> = value;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableKey((record[k] ?? null) as JsonValue)}`)
    .join(',')}}`;
}

export function createAgentCalls(rt: Pick<Runtime, 'surfaces' | 'send' | 'emit'>): {
  callAgent: (surface: SurfaceState | undefined) => EvalEnv['callAgent'];
  resolveAgentCall: Runtime['resolveAgentCall'];
} {
  const pending = new Map<string, { surfaceId: string; key: string }>();
  let counter = 0;
  return {
    callAgent: (surface) => (catalogId, name, args) => {
      if (surface === undefined) return { pending: false, error: `Function '${name}' is not available here.` };
      const key = stableKey({ catalogId, name, args });
      const known = surface.agentCalls.get(key);
      if (known !== undefined) return known;
      counter += 1;
      const functionCallId = `${surface.id}.${Date.now().toString(36)}.${counter}`;
      surface.agentCalls.set(key, { functionCallId, pending: true });
      pending.set(functionCallId, { surfaceId: surface.id, key });
      const callFunction = { '@call': name, catalogId, args: JSON.parse(JSON.stringify(args)) as JsonObject };
      rt.send({ version: A2UI_VERSION, callAgentFunction: { surfaceId: surface.id, functionCallId, callFunction } }, surface.id);
      return { pending: true };
    },
    resolveAgentCall: (response) => {
      const entry = pending.get(response.functionCallId);
      const surface = entry === undefined ? undefined : rt.surfaces.get(entry.surfaceId);
      if (entry === undefined || surface === undefined) return;
      pending.delete(response.functionCallId);
      const error = response.error === undefined ? undefined : `${response.error.code}: ${response.error.message}`;
      surface.agentCalls.set(entry.key, { functionCallId: response.functionCallId, pending: false, value: response.value, error });
      bump(rt, surface);
    },
  };
}
