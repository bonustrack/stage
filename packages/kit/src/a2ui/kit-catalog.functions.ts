import { entriesOf, isJsonObject, type JsonObject, type JsonValue } from './protocol';
import { basic, common } from './kit-catalog.props';
import { BASIC_CATALOG } from './schemas';

const AGENT_CALLABLE = new Set(['formatString', 'formatNumber', 'formatCurrency', 'formatDate', 'pluralize']);

function inheritedFunction(name: string, definition: JsonValue): JsonObject {
  const source = isJsonObject(definition) ? definition : {};
  const inherited = Object.fromEntries(
    entriesOf(source).filter(([key]) => ['returnType', 'allowedCallers', 'requiresUserActivation', 'description'].includes(key)),
  );
  const meta = AGENT_CALLABLE.has(name) ? { ...inherited, allowedCallers: 'rendererOrAgent', requiresUserActivation: false } : inherited;
  const props = isJsonObject(source.properties) ? source.properties : {};
  return {
    type: 'object',
    ...meta,
    properties: { '@call': { const: name }, ...(props.args === undefined ? {} : { args: basic(`/functions/${name}/properties/args`) }) },
    required: Array.isArray(source.required) ? source.required : ['@call'],
  };
}

const BASIC_FUNCTIONS = isJsonObject(BASIC_CATALOG.functions) ? BASIC_CATALOG.functions : {};
export const KIT_FUNCTIONS: Record<string, JsonObject> = {
  ...Object.fromEntries(entriesOf(BASIC_FUNCTIONS).map(([name, def]) => [name, inheritedFunction(name, def)])),
  openSurface: {
    type: 'object',
    description:
      'Shows another surface of the same message as a new screen with a back button (requires user activation). This function has no return value.',
    returnType: 'void',
    requiresUserActivation: true,
    properties: {
      '@call': { const: 'openSurface' },
      args: {
        type: 'object',
        properties: {
          surfaceId: {
            description: 'The id of the surface to show.',
            oneOf: [{ type: 'string' }, common('DataBinding'), common('FunctionCall')],
          },
        },
        required: ['surfaceId'],
        unevaluatedProperties: false,
      },
    },
    required: ['@call', 'args'],
  },
  equals: {
    type: 'object',
    description:
      'Checks that two values are equal (strings, numbers, booleans, or lists and objects compared as JSON). Use it in checks, for example a Save button that stays disabled until a field differs from its saved value: wrap it in not.',
    returnType: 'boolean',
    allowedCallers: 'rendererOrAgent',
    requiresUserActivation: false,
    properties: {
      '@call': { const: 'equals' },
      args: {
        type: 'object',
        properties: { value: common('DynamicValue'), other: common('DynamicValue') },
        required: ['value', 'other'],
        unevaluatedProperties: false,
      },
    },
    required: ['@call', 'args'],
  },
  closeSurface: {
    type: 'object',
    description: 'Goes back to the screen shown before the last openSurface (requires user activation). This function has no return value.',
    returnType: 'void',
    requiresUserActivation: true,
    properties: { '@call': { const: 'closeSurface' } },
    required: ['@call'],
  },
};
