/** Bot API shapes used by the telegram station + helpers. Pass-through `payload` values. */

type Entity = { type: string; offset: number; length: number; user?: { id: number } };
type Photo = { file_id: string };
type Doc = { file_id: string; mime_type?: string; file_name?: string };
type Sticker = { file_id: string; emoji?: string; set_name?: string; type?: string };
type Dice = { emoji?: string; value?: number };

export type TelegramPayload = {
  message_id: number; date?: number; edit_date?: number;
  chat?: { id: number; type?: string; is_forum?: boolean; title?: string; first_name?: string };
  message_thread_id?: number; is_topic_message?: boolean;
  text?: string; caption?: string; entities?: Entity[]; caption_entities?: Entity[];
  photo?: Photo[]; document?: Doc; voice?: Doc; audio?: Doc;
  sticker?: Sticker; animation?: Doc; video?: Doc; video_note?: Doc;
  dice?: Dice; poll?: Record<string, unknown>; contact?: Record<string, unknown>;
  location?: Record<string, unknown>; venue?: Record<string, unknown>;
  new_chat_members?: unknown[]; left_chat_member?: unknown; pinned_message?: unknown;
  forward_origin?: unknown; forward_from?: unknown; forward_from_chat?: unknown;
  from?: { id?: number; is_bot?: boolean; username?: string; first_name?: string };
  reply_to_message?: TelegramPayload;
};

export type ReactionType =
  | { type: 'emoji'; emoji: string }
  | { type: 'custom_emoji'; custom_emoji_id: string };

export type MessageReactionUpdated = {
  chat: { id: number; type?: string; title?: string; first_name?: string };
  message_id: number;
  user?: { id: number; username?: string; first_name?: string; is_bot?: boolean };
  date?: number;
  old_reaction: ReactionType[];
  new_reaction: ReactionType[];
};

export type RawUpdate = {
  update_id: number;
  message?: TelegramPayload;
  edited_message?: TelegramPayload;
  channel_post?: TelegramPayload;
  edited_channel_post?: TelegramPayload;
  message_reaction?: MessageReactionUpdated;
};
