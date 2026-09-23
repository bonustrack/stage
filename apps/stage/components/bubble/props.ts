import type { HistoryEntry } from '@stage-labs/client/types';
import type { MenuPoint } from '../AnchoredMenu.model';

export interface MenuAnchor { y: number; height: number; point?: MenuPoint | null }

export function initialMenuAnchor(cached: MenuAnchor, hasNode: boolean): MenuAnchor | null {
  const cachedAnchorIsValid = cached.height > 0;
  if (cachedAnchorIsValid || !hasNode) return cached;
  return null;
}

export interface MessengerBubbleProps {
  entry: HistoryEntry; dark: boolean; pending?: boolean; replyTarget?: boolean;
  onReact?: (emoji: string) => void; onReply?: () => void;
  onOpenMenu?: (anchor: MenuAnchor) => void;
  onReplyPreviewPress?: () => void;
  onAnswer?: (label: string) => void;
  replyPreview?: string; reactions?: Map<string, number>;
  pendingReactions?: string[];
  pendingRemovals?: string[];
  ownEmojis?: Set<string>;
  myUri: string;
  senderEthAddress?: string | null;
  onAvatarPress?: (address: string) => void;
  votes?: Map<number, Map<number, Set<string>>>;
  ownVotes?: Map<number, Set<number>>;
  onVote?: (questionIndex: number, optionIndex: number, action: 'added' | 'removed') => void;
  openAnswers?: Map<number, Map<string, { text: string; ts: string }>>;
  onOpenAnswer?: (questionIndex: number, text: string) => void;
  onPay?: () => void;
  paying?: boolean;
  onSign?: () => void;
  signing?: boolean;
  consentAllowed?: boolean;
  selectable?: boolean;
  highlight?: string;
}
