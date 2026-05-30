/**
 * Reference train built on the defineTrain SDK (#13).
 *
 * This is a self-contained "echo" platform with no external service — it proves
 * the SDK end-to-end in ~50 lines (vs ~120 for the hand-rolled telegram.ts).
 * Every `send`/`react`/`reply` is echoed straight back as an inbound event, and
 * a heartbeat fires once a second. Copy this shape and swap the inbound loop +
 * actions for a real platform (Telegram long-poll, Discord gateway, XMTP stream).
 *
 *   cp examples/echo.ts ~/.metro/trains/echo.ts
 *   metro call echo send '{"line":"metro://echo/demo","text":"hi"}'
 */

import { defineTrain } from '@metro-labs/metro/define-train';

type Target = { room: string };
const parseLine = (line: string): Target | null => {
  const m = line.match(/^metro:\/\/echo\/([^/]+)$/);
  return m ? { room: m[1] } : null;
};

await defineTrain<null>({
  name: 'echo',
  parseLine,

  // Inbound loop: a 1 Hz heartbeat, just to show ctx.emitInbound in a loop.
  onInbound: async ctx => {
    for (;;) {
      await new Promise(r => setTimeout(r, 1000));
      ctx.emitInbound({
        line: 'metro://echo/heartbeat',
        from: 'metro://echo/user/clock',
        from_name: 'clock',
        text: `tick ${new Date().toISOString()}`,
      });
    }
  },

  actions: {
    send: (args, ctx) => {
      const { line, text } = args as { line: string; text: string };
      if (!parseLine(line)) throw new Error(`bad echo line: ${line}`);
      const messageId = ctx.mintId();
      ctx.emitOutbound({ line, message_id: messageId, text });
      // Echo it back as if a peer replied.
      ctx.emitInbound({ line, from: 'metro://echo/user/peer', from_name: 'peer', text: `echo: ${text}` });
      return { messageId };
    },

    react: (args, ctx) => {
      const { line, messageId, emoji } = args as { line: string; messageId: string; emoji: string };
      if (!parseLine(line)) throw new Error(`bad echo line: ${line}`);
      const id = ctx.mintId();
      ctx.emitOutbound({ line, message_id: id, text: `[react ${emoji}]`, reply_to: messageId });
      return { messageId: id };
    },

    reply: (args, ctx) => {
      const { line, replyTo, text } = args as { line: string; replyTo: string; text: string };
      if (!parseLine(line)) throw new Error(`bad echo line: ${line}`);
      const id = ctx.mintId();
      ctx.emitOutbound({ line, message_id: id, text, reply_to: replyTo });
      return { messageId: id };
    },
  },
});
