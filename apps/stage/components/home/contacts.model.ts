import { parseHandle } from '@stage-labs/client/routing/handles';
import { displayHandle, validateStageLabel } from '@stage-labs/client/identity/stageNames';

export interface PeopleLookup {
  handle: string;
  title: string;
}

export function peopleLookup(query: string): PeopleLookup | null {
  const parsed = parseHandle(query.trim().replace(/^@/, ''));
  if (parsed.kind === 'address') return { handle: parsed.value, title: '' };
  if (parsed.kind === 'stage') {
    const label = parsed.value.slice(0, parsed.value.indexOf('.'));
    if (validateStageLabel(label) !== null) return null;
    return { handle: parsed.value, title: displayHandle(parsed.value) };
  }
  if (parsed.kind === 'basename' || parsed.kind === 'ens') {
    return { handle: parsed.value, title: parsed.value };
  }
  return null;
}
