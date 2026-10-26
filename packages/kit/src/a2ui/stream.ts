import { isJsonObject, type JsonValue } from './protocol';

function parseLines(text: string, onError: (message: string) => void): JsonValue[] {
  const out: JsonValue[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      out.push(JSON.parse(trimmed) as JsonValue);
    } catch {
      onError(`Could not parse A2UI message line: ${trimmed.slice(0, 80)}`);
    }
  }
  return out;
}

function parseText(text: string, onError: (message: string) => void): JsonValue[] {
  try {
    return [JSON.parse(text) as JsonValue];
  } catch {
    return parseLines(text, onError);
  }
}

function flatten(value: JsonValue): JsonValue[] {
  if (Array.isArray(value)) return value;
  if (isJsonObject(value) && Array.isArray(value.messages) && Object.keys(value).length === 1) return value.messages;
  return [value];
}

export function parseMessages(input: string | JsonValue, onError: (message: string) => void): JsonValue[] {
  const parsed = typeof input === 'string' ? parseText(input, onError) : [input];
  return parsed.flatMap(flatten);
}
