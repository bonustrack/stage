type BodyPart =
  | { type: 'text'; text: string }
  | { type: 'code'; code: string; lang?: string };

interface Fence { indent: number; marker: string; lang?: string }

const OPEN_FENCE_RE = /^( *)(`{3,}|~{3,})(.*)$/;
const FENCE_HINT_RE = /^ *(?:`{3}|~{3})/m;

function openFence(line: string): Fence | undefined {
  const m = OPEN_FENCE_RE.exec(line);
  if (!m) return undefined;
  const marker = m[2] ?? '';
  const info = (m[3] ?? '').trim();
  if (marker.startsWith('`') && info.includes('`')) return undefined;
  const lang = info.split(/\s+/)[0] ?? '';
  const indent = (m[1] ?? '').length;
  return lang === '' ? { indent, marker } : { indent, marker, lang };
}

function closesFence(line: string, fence: Fence): boolean {
  const run = line.trim();
  return run.length >= fence.marker.length && run === fence.marker.charAt(0).repeat(run.length);
}

function dedent(line: string, indent: number): string {
  let n = 0;
  while (n < indent && line.charAt(n) === ' ') n += 1;
  return line.slice(n);
}

function trimBlankEdges(lines: string[]): string {
  let start = 0;
  let end = lines.length;
  while (start < end && (lines[start] ?? '').trim() === '') start += 1;
  while (end > start && (lines[end - 1] ?? '').trim() === '') end -= 1;
  return lines.slice(start, end).join('\n');
}

function codePart(fence: Fence, lines: string[]): BodyPart {
  const code = lines.join('\n');
  return fence.lang === undefined ? { type: 'code', code } : { type: 'code', code, lang: fence.lang };
}

export function splitCodeBlocks(body: string): BodyPart[] {
  const whole: BodyPart[] = [{ type: 'text', text: body }];
  if (!FENCE_HINT_RE.test(body)) return whole;
  const parts: BodyPart[] = [];
  let text: string[] = [];
  let code: string[] = [];
  let fence: Fence | undefined;
  const flushText = (): void => {
    const joined = trimBlankEdges(text);
    if (joined !== '') parts.push({ type: 'text', text: joined });
    text = [];
  };
  for (const line of body.split(/\r?\n/)) {
    if (fence) {
      if (closesFence(line, fence)) {
        parts.push(codePart(fence, code));
        fence = undefined;
        code = [];
      } else code.push(dedent(line, fence.indent));
      continue;
    }
    fence = openFence(line);
    if (fence) flushText();
    else text.push(line);
  }
  if (fence) parts.push(codePart(fence, code));
  flushText();
  return parts.some(part => part.type === 'code') ? parts : whole;
}
