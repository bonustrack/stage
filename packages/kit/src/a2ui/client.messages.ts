import type { CatalogRegistry } from './catalog';
import { resolveDynamic, ROOT_SCOPE, toDiagnostic, type Diagnostic, type EvalEnv } from './evaluate';
import { setAt } from './pointer';
import {
  A2UI_VERSION, ERROR_CODES, isJsonObject,
  type CallRendererFunction, type ComponentInstance, type CreateSurface, type FunctionResponse,
  type JsonValue, type RendererMessage, type UpdateComponents, type UpdateDataModel,
} from './protocol';
import { compositionIssues } from './structure';
import { createSurfaceState, type SurfaceState } from './surface';
import type { FunctionImpl } from './functions';

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

function sendError(rt: Runtime, error: { code: string; message: string; surfaceId?: string; path?: string; functionCallId?: string }): void {
  rt.send({ version: A2UI_VERSION, error }, error.surfaceId);
}

function validationError(rt: Runtime, surfaceId: string, path: string, message: string): void {
  sendError(rt, { code: ERROR_CODES.validation, surfaceId, path, message });
}

function integrityError(rt: Runtime, surfaceId: string, message: string): void {
  sendError(rt, { code: ERROR_CODES.integrity, surfaceId, message });
}

function catalogOf(surface: SurfaceState, component: ComponentInstance): string | undefined {
  return component.catalogId ?? surface.catalogId;
}

function acceptComponent(rt: Runtime, surface: SurfaceState, component: ComponentInstance, path: string[]): boolean {
  if (!rt.validate) return true;
  const catalogId = catalogOf(surface, component);
  if (catalogId === undefined) {
    validationError(rt, surface.id, `/${path.join('/')}/catalogId`, `Component '${component.id}' has no catalog to resolve against.`);
    return false;
  }
  const [first] = rt.registry.validateComponent(catalogId, component, path);
  if (first === undefined) return true;
  validationError(rt, surface.id, first.path, first.message);
  return false;
}

function reportComposition(rt: Runtime, surface: SurfaceState): void {
  for (const found of compositionIssues(surface.components, rt.registry, surface.catalogId)) {
    const key = `${found.code}:${found.componentId}:${found.message}`;
    if (surface.reported.has(key)) continue;
    surface.reported.add(key);
    sendError(rt, { code: found.code, surfaceId: surface.id, path: `/components/${found.componentId}`, message: found.message });
  }
}

function applyComponents(rt: Runtime, surface: SurfaceState, components: readonly ComponentInstance[], base: string[]): void {
  components.forEach((component, index) => {
    if (acceptComponent(rt, surface, component, [...base, String(index)])) surface.components.set(component.id, component);
  });
  reportComposition(rt, surface);
}

function bump(rt: Runtime, surface: SurfaceState): void {
  surface.version += 1;
  rt.emit(surface.id);
}

function supportsCatalog(rt: Runtime, catalogId: string | undefined): boolean {
  return catalogId === undefined || rt.registry.catalog(catalogId) !== undefined;
}

export function onCreateSurface(rt: Runtime, msg: CreateSurface): void {
  if (rt.surfaces.has(msg.surfaceId)) {
    integrityError(rt, msg.surfaceId, `Surface '${msg.surfaceId}' already exists. Delete it before creating it again.`);
    return;
  }
  if (!supportsCatalog(rt, msg.catalogId)) {
    sendError(rt, { code: ERROR_CODES.unsupportedCatalog, surfaceId: msg.surfaceId, message: `Catalog '${String(msg.catalogId)}' is not supported by this renderer.` });
    return;
  }
  const surface = createSurfaceState(msg.surfaceId, msg.catalogId, msg.sendDataModel === true, isJsonObject(msg.metadata) ? msg.metadata : undefined);
  rt.surfaces.set(msg.surfaceId, surface);
  if (isJsonObject(msg.dataModel)) surface.data = msg.dataModel;
  if (msg.components !== undefined) applyComponents(rt, surface, msg.components, ['createSurface', 'components']);
  bump(rt, surface);
}

function requireSurface(rt: Runtime, surfaceId: string): SurfaceState | undefined {
  const surface = rt.surfaces.get(surfaceId);
  if (surface === undefined) integrityError(rt, surfaceId, `Surface '${surfaceId}' does not exist. Send createSurface first.`);
  return surface;
}

export function onUpdateComponents(rt: Runtime, msg: UpdateComponents): void {
  const surface = requireSurface(rt, msg.surfaceId);
  if (surface === undefined) return;
  applyComponents(rt, surface, msg.components, ['updateComponents', 'components']);
  bump(rt, surface);
}

export function onUpdateDataModel(rt: Runtime, msg: UpdateDataModel): void {
  const surface = requireSurface(rt, msg.surfaceId);
  if (surface === undefined) return;
  surface.data = setAt(surface.data, msg.path ?? '/', msg.value ?? undefined);
  bump(rt, surface);
}

export function onDeleteSurface(rt: Runtime, surfaceId: string): void {
  if (!rt.surfaces.delete(surfaceId)) return;
  rt.emit(surfaceId);
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

function respond(rt: Runtime, response: FunctionResponse): void {
  rt.send({ version: A2UI_VERSION, rendererFunctionResponse: response });
}

export function onCallRendererFunction(rt: Runtime, call: CallRendererFunction): void {
  const invalid = rendererCallError(call, rt);
  if (invalid !== undefined) {
    respond(rt, { functionCallId: call.functionCallId, error: { code: ERROR_CODES.invalidFunctionCall, message: invalid } });
    return;
  }
  const surface = call.surfaceId === undefined ? undefined : rt.surfaces.get(call.surfaceId);
  const env = rt.envFor(surface);
  const settle = (value: unknown): void => {
    respond(rt, { functionCallId: call.functionCallId, value: (value ?? null) as JsonValue });
  };
  const fail = (error: unknown): void => {
    const diagnostic = toDiagnostic(error);
    respond(rt, { functionCallId: call.functionCallId, error: { code: ERROR_CODES.execution, message: diagnostic.message } });
  };
  try {
    const result = resolveDynamic(call.callFunction, { ...env, catalogId: call.callFunction.catalogId }, ROOT_SCOPE);
    if (result instanceof Promise) result.then(settle, fail);
    else settle(result);
  } catch (error) {
    fail(error);
  }
}

export function onAgentFunctionResponse(rt: Runtime, response: FunctionResponse): void {
  rt.resolveAgentCall(response);
}
