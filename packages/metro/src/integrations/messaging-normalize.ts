// Train-side adapter for the standardized messaging contract. Translates the
// canonical envelope ({line,text,replyTo,attachments,emoji,messageId,...}) into a
// station's native (action,args) BEFORE the train's existing dispatch runs, so the
// canonical verbs work without rewriting each train's native handlers.

type Args = Record<string, unknown>;
export interface Normalized { action: string; args: Args }

interface Attachment { kind?: string; url?: string; data?: string; mime?: string; name?: string }

/** Local file paths (and http urls) → discord `files`/`images` multipart inputs. */
function discordAttachments(att: Attachment[]): Args {
  const files = att.map(a => a.url).filter((u): u is string => typeof u === 'string');
  return files.length ? { files } : {};
}

/** Map a canonical verb+envelope onto Discord's native action set. */
export function normalizeDiscord(action: string, env: Args): Normalized {
  const att = (env.attachments as Attachment[] | undefined) ?? [];
  if (action === 'send') {
    return { action: 'send', args: { ...env, ...discordAttachments(att) } };
  }
  if (action === 'reply') {
    // canonical reply carries `replyTo`; legacy callers already pass `messageId`.
    const messageId = env.replyTo ?? env.messageId;
    return { action: 'reply', args: { ...env, messageId, ...discordAttachments(att) } };
  }
  if (action === 'unreact') return { action: 'react', args: { ...env, emoji: '' } };
  if (action === 'read') {
    return { action: 'fetch', args: { line: env.line, limit: env.limit, before: env.before } };
  }
  return { action, args: env };
}

/** Map a canonical verb+envelope onto Telegram's native action set. */
export function normalizeTelegram(action: string, env: Args): Normalized {
  if (action === 'reply') {
    return { action: 'send', args: { line: env.line, text: env.text, replyTo: env.replyTo } };
  }
  if (action === 'unreact') return { action: 'react', args: { ...env, emoji: '' } };
  return { action, args: env };
}

/** Map a canonical verb+envelope onto XMTP's native action set. */
export function normalizeXmtp(action: string, env: Args): Normalized {
  if (action === 'unreact') {
    return { action: 'react', args: { ...env, action: 'removed' } };
  }
  if (action === 'read') {
    return { action: 'query', args: { line: env.line, limit: env.limit } };
  }
  return { action, args: env };
}
