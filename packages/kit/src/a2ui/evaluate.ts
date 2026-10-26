import type { CatalogRegistry } from './catalog';
import { A2uiExpressionError } from './expression';
import { isTruthyOrValid, type FunctionContext, type FunctionImpl } from './functions';
import { getAt, resolveScopedPath } from './pointer';
import {
  ERROR_CODES, entriesOf, isDataBinding, isFunctionCall, isJsonObject, isValidationResult,
  type CheckRule, type DynamicValue, type FunctionCall, type JsonObject, type JsonValue, type ValidationResult,
} from './protocol';

export interface Scope {
  path: string;
  indices: readonly number[];
}

export const ROOT_SCOPE: Scope = { path: '/', indices: [] };

export class A2uiEvaluationError extends Error {
  override readonly name = 'A2uiEvaluationError';
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

export interface AgentCallResult {
  pending: boolean;
  value?: JsonValue;
  error?: string;
}

export interface EvalEnv {
  catalogId: string | undefined;
  data: JsonObject;
  registry: CatalogRegistry;
  functions: (catalogId: string) => Record<string, FunctionImpl> | undefined;
  locale: string;
  openUrl: (url: string) => void;
  callAgent: (catalogId: string, name: string, args: Record<string, unknown>) => AgentCallResult;
}

const SINGLE_AT = /^@([^@]|$)/;

function unescapeKey(key: string): string | undefined {
  if (key.startsWith('@@')) return key.slice(1);
  return SINGLE_AT.test(key) ? undefined : key;
}

function plainObject(value: JsonObject, run: (v: DynamicValue) => unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, child] of entriesOf(value)) {
    const name = unescapeKey(key);
    if (name === undefined) throw new A2uiEvaluationError(ERROR_CODES.expression, `Unknown directive '${key}'.`);
    out[name] = run(child);
  }
  return out;
}

function indexCall(call: FunctionCall, scope: Scope, run: (v: DynamicValue) => unknown): number {
  const innermost = scope.indices[scope.indices.length - 1];
  if (innermost === undefined) throw new A2uiEvaluationError(ERROR_CODES.execution, '@index is only available inside a list template.');
  const offset = call.args === undefined ? 0 : Number(run(call.args.offset ?? 0));
  return innermost + (Number.isNaN(offset) ? 0 : offset);
}

function guardCaller(env: EvalEnv, catalogId: string, name: string, activation: boolean): void {
  const meta = env.registry.functionMeta(catalogId, name);
  if (meta?.allowedCallers === 'agentOnly') throw new A2uiEvaluationError(ERROR_CODES.expression, `Function '${name}' may only be called by the agent.`);
  if (meta?.requiresUserActivation === true && !activation) throw new A2uiEvaluationError(ERROR_CODES.expression, `Function '${name}' requires a user gesture.`);
}

function runLocal(impl: FunctionImpl, args: Record<string, unknown>, context: FunctionContext): unknown {
  try {
    return impl(args, context);
  } catch (error) {
    if (error instanceof A2uiEvaluationError) throw error;
    const { code, message } = toDiagnostic(error);
    throw new A2uiEvaluationError(code, message);
  }
}

function runRemote(env: EvalEnv, catalogId: string, name: string, args: Record<string, unknown>): unknown {
  const remote = env.callAgent(catalogId, name, args);
  if (remote.error !== undefined) throw new A2uiEvaluationError(ERROR_CODES.execution, remote.error);
  return remote.pending ? undefined : remote.value;
}

function callFunction(call: FunctionCall, env: EvalEnv, scope: Scope, activation: boolean): unknown {
  const run = (v: DynamicValue): unknown => resolveDynamic(v, env, scope, activation);
  const name = call['@call'];
  if (name === '@index') return indexCall(call, scope, run);
  const catalogId = call.catalogId ?? env.catalogId;
  if (catalogId === undefined) throw new A2uiEvaluationError(ERROR_CODES.expression, `No catalog to resolve function '${name}'.`);
  guardCaller(env, catalogId, name, activation);
  const args = call.args === undefined ? {} : plainObject(call.args, run);
  const impl = env.functions(catalogId)?.[name];
  if (impl === undefined) return runRemote(env, catalogId, name, args);
  return runLocal(impl, args, { activation, locale: env.locale, resolve: run, openUrl: env.openUrl });
}

export function resolveDynamic(value: DynamicValue | undefined, env: EvalEnv, scope: Scope, activation = false): unknown {
  if (value === undefined || value === null || typeof value !== 'object') return value;
  const run = (v: DynamicValue): unknown => resolveDynamic(v, env, scope, activation);
  if (Array.isArray(value)) return value.map(run);
  if (isDataBinding(value)) return getAt(env.data, resolveScopedPath(value['@path'], scope.path));
  if (isFunctionCall(value)) return callFunction(value, env, scope, activation);
  return plainObject(value, run);
}

export interface Diagnostic {
  code: string;
  message: string;
}

export function safeResolve(value: DynamicValue | undefined, env: EvalEnv, scope: Scope, report: (diagnostic: Diagnostic) => void): unknown {
  try {
    return resolveDynamic(value, env, scope);
  } catch (error) {
    report(toDiagnostic(error));
    return null;
  }
}

export function toDiagnostic(error: unknown): Diagnostic {
  if (error instanceof A2uiEvaluationError) return { code: error.code, message: error.message };
  if (error instanceof A2uiExpressionError) return { code: ERROR_CODES.expression, message: error.message };
  return { code: ERROR_CODES.execution, message: error instanceof Error ? error.message : String(error) };
}

export const toBoolean = isTruthyOrValid;

function coerceCheck(value: unknown, rule: CheckRule): ValidationResult {
  const result: ValidationResult = isValidationResult(value) ? value : { valid: Boolean(value) };
  return result.valid ? result : { ...result, message: result.message ?? rule.message ?? 'Validation failed', severity: result.severity ?? 'error' };
}

export function evaluateChecks(checks: readonly CheckRule[] | undefined, env: EvalEnv, scope: Scope): ValidationResult[] {
  if (checks === undefined) return [];
  return checks.map((rule) => {
    try {
      return coerceCheck(resolveDynamic(rule.condition, env, scope), rule);
    } catch (error) {
      return { valid: false, message: rule.message ?? toDiagnostic(error).message, severity: 'error' as const };
    }
  });
}

export function isCheckRuleList(value: unknown): value is CheckRule[] {
  return Array.isArray(value) && value.every((rule) => isJsonObject(rule) && (isDataBinding(rule.condition) || isFunctionCall(rule.condition)));
}
