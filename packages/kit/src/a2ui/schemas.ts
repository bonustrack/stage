import agentToRenderer from './schemas/agent_to_renderer.json';
import agentToRendererList from './schemas/agent_to_renderer_list.json';
import agentToRendererListWrapper from './schemas/agent_to_renderer_list_wrapper.json';
import rendererToAgent from './schemas/renderer_to_agent.json';
import rendererToAgentList from './schemas/renderer_to_agent_list.json';
import rendererToAgentListWrapper from './schemas/renderer_to_agent_list_wrapper.json';
import commonTypes from './schemas/common_types.json';
import catalogDefinition from './schemas/catalog_definition.json';
import agentCapabilities from './schemas/agent_capabilities.json';
import rendererCapabilities from './schemas/renderer_capabilities.json';
import rendererDataModel from './schemas/renderer_data_model.json';
import basicCatalog from './schemas/basic_catalog.json';
import type { JsonObject } from './protocol';

function asObject(value: unknown): JsonObject {
  return value as JsonObject;
}

export const PROTOCOL_SCHEMAS = {
  agentToRenderer: asObject(agentToRenderer),
  agentToRendererList: asObject(agentToRendererList),
  agentToRendererListWrapper: asObject(agentToRendererListWrapper),
  rendererToAgent: asObject(rendererToAgent),
  rendererToAgentList: asObject(rendererToAgentList),
  rendererToAgentListWrapper: asObject(rendererToAgentListWrapper),
  commonTypes: asObject(commonTypes),
  catalogDefinition: asObject(catalogDefinition),
  agentCapabilities: asObject(agentCapabilities),
  rendererCapabilities: asObject(rendererCapabilities),
  rendererDataModel: asObject(rendererDataModel),
} as const;

export const BASIC_CATALOG: JsonObject = asObject(basicCatalog);

export const PROTOCOL_DOCUMENTS: readonly JsonObject[] = Object.values(PROTOCOL_SCHEMAS);
