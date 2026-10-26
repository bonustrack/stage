import type { FunctionImpl } from './functions';
import type { JsonObject } from './protocol';

export type SurfaceNav = { kind: 'open'; surfaceId: string } | { kind: 'close' };

const surfaceArg = (description: string): JsonObject => ({
  type: 'object',
  properties: {
    surfaceId: { description, oneOf: [{ type: 'string' }, { $ref: 'common_types.json#/$defs/DataBinding' }, { $ref: 'common_types.json#/$defs/FunctionCall' }] },
  },
  required: ['surfaceId'],
  unevaluatedProperties: false,
});

const AGENT_FUNCTION: JsonObject = {
  type: 'object',
  description: 'Asks the agent that owns the surface to compute a value: the renderer sends a callAgentFunction with this call and shows the value once the agent answers. `name` picks the agent\'s function and `args` are its arguments.',
  returnType: 'any',
  properties: {
    '@call': { const: 'agentFunction' },
    args: {
      type: 'object',
      properties: {
        name: { description: 'The agent function to run.', oneOf: [{ type: 'string' }, { $ref: 'common_types.json#/$defs/DataBinding' }] },
        args: { description: 'Its arguments.', type: 'object' },
      },
      required: ['name'],
      unevaluatedProperties: false,
    },
  },
  required: ['@call', 'args'],
};

export const KIT_EXTRA_FUNCTIONS: Record<string, JsonObject> = {
  agentFunction: AGENT_FUNCTION,
  openSurface: {
    type: 'object',
    description: 'Shows another surface of the same message as a new screen with a back button (requires user activation). This function has no return value.',
    returnType: 'void',
    requiresUserActivation: true,
    properties: { '@call': { const: 'openSurface' }, args: surfaceArg('The id of the surface to show.') },
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

export function createKitFunctions(navigate: ((nav: SurfaceNav) => void) | undefined): Record<string, FunctionImpl> {
  return {
    openSurface: (args) => {
      if (typeof args.surfaceId !== 'string' || args.surfaceId === '') throw new Error('openSurface needs a surfaceId.');
      navigate?.({ kind: 'open', surfaceId: args.surfaceId });
    },
    closeSurface: () => {
      navigate?.({ kind: 'close' });
    },
  };
}
