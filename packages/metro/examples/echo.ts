// Reference train on the defineTrain SDK (#13): a self-contained 'echo'
// platform with no external service. Every send/react/reply is echoed back
// as inbound, and a heartbeat fires once a second. See README for usage.

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
