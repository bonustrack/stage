export const A2UI_VERSION = 'v1.0';
export const A2UI_PROTOCOL_VERSION = '1.0';
export const BASIC_CATALOG_ID = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';
export const SURFACE_COMPONENT = 'Surface';
export const ROOT_ID = 'root';

export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
export interface JsonObject {
  [key: string]: JsonValue | JsonObject | undefined;
}

export interface DataBinding extends JsonObject {
  '@path': string;
}

export interface FunctionCall extends JsonObject {
  '@call': string;
  catalogId?: string;
  args?: JsonObject;
  returnType?: string;
}

export type DynamicValue = JsonValue;

export interface ComponentInstance extends JsonObject {
  id: string;
  component: string;
  catalogId?: string;
}

export interface ChildTemplate extends JsonObject {
  componentId: string;
  path: string;
}

export type ChildList = string[] | ChildTemplate;

export interface EventAction extends JsonObject {
  event: { name: string; userMessage?: DynamicValue; context?: JsonObject };
}

export interface FunctionAction extends JsonObject {
  functionCall: FunctionCall;
}

export type Action = EventAction | FunctionAction;

export interface CheckRule extends JsonObject {
  condition: DataBinding | FunctionCall;
  message?: string;
}

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationResult extends JsonObject {
  valid: boolean;
  code?: string;
  message?: string;
  severity?: Severity;
}

export interface FunctionError {
  code: string;
  message: string;
}

export interface CreateSurface {
  surfaceId: string;
  catalogId?: string;
  sendDataModel?: boolean;
  components?: ComponentInstance[];
  dataModel?: JsonObject;
  metadata?: { extensions?: JsonObject };
}

export interface UpdateComponents {
  surfaceId: string;
  components: ComponentInstance[];
}

export interface UpdateDataModel {
  surfaceId: string;
  path?: string;
  value: JsonValue;
}

export interface CallRendererFunction {
  surfaceId?: string;
  functionCallId: string;
  callFunction: FunctionCall & { catalogId: string };
}

export interface FunctionResponse {
  functionCallId: string;
  value?: JsonValue;
  error?: FunctionError;
}

export type AgentMessage =
  | { version: typeof A2UI_VERSION; createSurface: CreateSurface }
  | { version: typeof A2UI_VERSION; updateComponents: UpdateComponents }
  | { version: typeof A2UI_VERSION; updateDataModel: UpdateDataModel }
  | { version: typeof A2UI_VERSION; deleteSurface: { surfaceId: string } }
  | { version: typeof A2UI_VERSION; callRendererFunction: CallRendererFunction }
  | { version: typeof A2UI_VERSION; agentFunctionResponse: FunctionResponse };

export interface ActionEvent {
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  timestamp: string;
  context: JsonObject;
  userMessage?: string;
  metadata?: { extensions?: JsonObject };
}

export interface CallAgentFunction {
  surfaceId: string;
  functionCallId: string;
  callFunction: FunctionCall;
}

export type ValidationErrorCode = 'VALIDATION_FAILED' | 'UNALLOWED_PARENT' | 'UNALLOWED_CHILD';

export interface RendererError {
  code: string;
  message: string;
  surfaceId?: string;
  functionCallId?: string;
  path?: string;
}

export type RendererMessage =
  | { version: typeof A2UI_VERSION; action: ActionEvent }
  | { version: typeof A2UI_VERSION; callAgentFunction: CallAgentFunction }
  | { version: typeof A2UI_VERSION; rendererFunctionResponse: FunctionResponse }
  | { version: typeof A2UI_VERSION; error: RendererError };

export interface RendererDataModel {
  version: typeof A2UI_VERSION;
  surfaces: Record<string, JsonValue>;
}

export interface RendererCapabilities {
  'v1.0': { supportedCatalogIds: string[]; inlineCatalogs?: JsonObject[] };
}

export interface AgentCapabilities {
  'v1.0': { supportedCatalogIds: string[]; acceptsInlineCatalogs?: boolean };
}

export const ERROR_CODES = {
  validation: 'VALIDATION_FAILED',
  unallowedParent: 'UNALLOWED_PARENT',
  unallowedChild: 'UNALLOWED_CHILD',
  integrity: 'INTEGRITY_ERROR',
  invalidFunctionCall: 'INVALID_FUNCTION_CALL',
  execution: 'EXECUTION_ERROR',
  expression: 'EXPRESSION_ERROR',
  unknownFunction: 'UNKNOWN_FUNCTION',
  unsupportedCatalog: 'UNSUPPORTED_CATALOG',
} as const;

export function entriesOf(value: JsonObject): [string, JsonValue][] {
  return Object.entries(value).filter((entry): entry is [string, JsonValue] => entry[1] !== undefined);
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isDataBinding(value: unknown): value is DataBinding {
  return isJsonObject(value) && typeof value['@path'] === 'string';
}

export function isFunctionCall(value: unknown): value is FunctionCall {
  return isJsonObject(value) && typeof value['@call'] === 'string';
}

export function isValidationResult(value: unknown): value is ValidationResult {
  return isJsonObject(value) && typeof value.valid === 'boolean';
}

export function isEventAction(value: unknown): value is EventAction {
  return isJsonObject(value) && isJsonObject(value.event) && typeof value.event.name === 'string';
}

export function isFunctionAction(value: unknown): value is FunctionAction {
  return isJsonObject(value) && isFunctionCall(value.functionCall);
}

export function isChildTemplate(value: unknown): value is ChildTemplate {
  return isJsonObject(value) && typeof value.componentId === 'string' && typeof value.path === 'string';
}
