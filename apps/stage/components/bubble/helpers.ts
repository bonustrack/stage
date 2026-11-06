import type { HistoryEntry } from '@stage-labs/client/types';
import { Platform } from 'react-native';
import { fontFamily, fontSize, type FontSizeName } from '@stage-labs/kit/tokens';
import type { LinkClickEvent } from '@stage-labs/kit/link';
import { markdownStyles as kitMarkdownStyles } from '@stage-labs/kit/markdown-styles';
import type { RemoteAttachmentInfo } from '@xmtp/react-native-sdk';
import { normalizeQuestions, type PollQuestion } from '@stage-labs/client/xmtp/poll';
import { attachmentsOf as entryAttachmentsOf, pollContentOf } from '@stage-labs/client/xmtp/entryPayload';
import { MarkdownIt } from 'react-native-markdown-display';
import { registerDeepLinkSchemas } from '@stage-labs/client/text/markdown';
import type { LinkFinder } from '@stage-labs/client/xmtp/messageBody';
import { MESSAGE_LINK_COLOR } from '../../lib/uiColors';
import { keepIndent, literalStars, taskLists } from './markdown.model';

export const REACT_PRESETS = ['👍', '🔥', '👀', '🙏', '😁', '💯', '🫡'];

export const mdParser = MarkdownIt({ typographer: false, linkify: true, breaks: true }).use(literalStars).use(taskLists).use(keepIndent);

registerDeepLinkSchemas(mdParser.linkify);

export const findLinks: LinkFinder = (text) => mdParser.linkify.match(text);

export interface Attachment {
  id?: string;
  url?: string;
  dataB64?: string;
  remote?: RemoteAttachmentInfo;
  kind: string;
  mime?: string;
  size?: number;
  name?: string;
}

export function attachmentsOf(entry: HistoryEntry): Attachment[] {
  return entryAttachmentsOf(entry) as Attachment[];
}

export const MESSAGE_LINK_STYLE = { textDecorationLine: 'none' } as const;

export type LinkPress = ((url: string) => boolean) | undefined;

export interface BubbleLinkProps {
  accessibilityRole?: 'link';
  onPress?: (event?: LinkClickEvent) => void;
  href?: string;
  hrefAttrs?: { target: string; rel: string };
  ref?: (node: unknown) => void;
}

export const BLOCK_GAP = 8;

export const MONO_FONT = Platform.select({ ios: fontFamily.mono[0], android: 'monospace', default: fontFamily.mono.join(', ') });

export function markdownStyles(fg: string, dark: boolean, size: FontSizeName): Record<string, object> {
  const link = MESSAGE_LINK_COLOR[dark ? 'dark' : 'light'];
  const styles = kitMarkdownStyles({ fg, dark, link, fontSize: fontSize(size), lineHeight: 23, paragraphGap: 0 });
  const selection = { userSelect: Platform.OS === 'web' ? 'text' : 'none' };
  return {
    ...styles,
    body: { ...styles.body, gap: BLOCK_GAP },
    hr: { ...styles.hr, marginVertical: BLOCK_GAP / 2 },
    link: { ...styles.link, ...MESSAGE_LINK_STYLE },
    textgroup: { ...styles.textgroup, ...selection },
    bullet_list_icon: { ...styles.bullet_list_icon, ...selection },
    ordered_list_icon: { ...styles.ordered_list_icon, ...selection },
    code_inline: { ...styles.code_inline, fontFamily: MONO_FONT, ...selection },
    code_block: { ...styles.code_block, fontFamily: MONO_FONT, ...selection },
    fence: { ...styles.fence, fontFamily: MONO_FONT, ...selection },
  };
}

interface QuestionOption {
  label: string;
  description?: string;
}
export interface Question {
  header?: string;
  options: QuestionOption[];
  multiSelect?: boolean;
  allowOther?: boolean;
}

export function questionOf(entry: HistoryEntry): Question | undefined {
  const p = entry.payload as { question?: Question } | undefined;
  if (!p?.question || !Array.isArray(p.question.options)) return undefined;
  return p.question;
}

export interface Poll {
  question?: string;
  questions: PollQuestion[];
}

export function pollOf(entry: HistoryEntry): Poll | undefined {
  const raw = pollContentOf(entry);
  if (!raw) return undefined;
  const questions = normalizeQuestions(raw);
  const first = questions[0];
  if (first === undefined) return undefined;
  return { question: first.question, questions };
}

export function fmtSigValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') {
    if (/^0x[0-9a-fA-F]{42,}$/.test(v) && v.length > 24) return `${v.slice(0, 12)}…${v.slice(-8)}`;
    return v;
  }
  if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 200 ? `${s.slice(0, 197)}…` : s;
  } catch {
    return '[unserializable]';
  }
}
