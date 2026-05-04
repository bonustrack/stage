// MCP server: tools that read the per-request Telegram chat from
// AsyncLocalStorage. The HTTP handler runs each request inside a context
// populated from the bearer token; stdio mode populates it once at boot
// from TELEGRAM_CHAT_ID.

import { AsyncLocalStorage } from "node:async_hooks";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ask, type ChatId, type Notify, sendMessage } from "./telegram.js";

type UserContext = { chat_id: ChatId; user_name: string };
const userContext = new AsyncLocalStorage<UserContext>();

export function runWithUser<T>(ctx: UserContext, fn: () => T): T {
  return userContext.run(ctx, fn);
}

function currentUser(): UserContext {
  const ctx = userContext.getStore();
  if (!ctx) throw new Error("no user context — request not authenticated");
  return ctx;
}

export function buildServer(): McpServer {
  const s = new McpServer(
    { name: "@metro-labs/mcp", version: "0.2.0" },
    { capabilities: { logging: {} } },
  );

  // Rich-content options shared by notify and ask. Telegram parse modes:
  //   - HTML        : <b> <i> <u> <s> <a href> <code> <pre> <blockquote> <tg-spoiler>
  //   - MarkdownV2  : *bold* _italic_ __underline__ ~strike~ ||spoiler|| `code` ```pre``` [text](url)
  //                   (special chars _ * [ ] ( ) ~ ` > # + - = | { } . ! must be backslash-escaped)
  const parseModeSchema = z
    .enum(["HTML", "MarkdownV2"])
    .optional()
    .describe(
      "Telegram parse mode. Use 'HTML' for tags like <b>/<i>/<a href>/<code>/<pre>/<blockquote>/<tg-spoiler>, " +
        "or 'MarkdownV2' for *bold*/_italic_/`code`/[text](url)/||spoiler|| (escape _ * [ ] ( ) ~ ` > # + - = | { } . ! with \\). " +
        "Omit for plain text.",
    );
  const disableLinkPreviewSchema = z
    .boolean()
    .optional()
    .describe("Suppress the auto link preview Telegram appends when the message contains a URL.");
  const urlButtonSchema = z.object({
    text: z.string().describe("Label shown on the button."),
    url: z.string().describe("URL to open when the user taps the button."),
  });
  const callbackButtonSchema = z.object({
    text: z.string().describe("Label shown on the button."),
    callbackData: z
      .string()
      .max(64)
      .describe("String returned as the user's reply when the button is tapped (max 64 bytes)."),
  });

  s.registerTool(
    "metro-notify",
    {
      description:
        "Send a one-way message to the user via Telegram (no reply expected). " +
        "Supports HTML/MarkdownV2 formatting and inline URL buttons.",
      inputSchema: {
        message: z.string().describe("Message body. Format depends on parseMode."),
        parseMode: parseModeSchema,
        disableLinkPreview: disableLinkPreviewSchema,
        buttons: z
          .array(z.array(urlButtonSchema))
          .optional()
          .describe(
            "Inline keyboard rendered under the message. Outer array = rows, inner array = buttons in that row. " +
              "Notify only supports URL buttons since there's no reply channel for callbacks.",
          ),
      },
    },
    async ({ message, parseMode, disableLinkPreview, buttons }) => {
      const { chat_id } = currentUser();
      await sendMessage(chat_id, message, { parseMode, disableLinkPreview, buttons });
      return { content: [{ type: "text", text: "sent" }] };
    },
  );

  s.registerTool(
    "metro-ask",
    {
      description:
        "Send a question to the user via Telegram and wait for their reply. " +
        "The reply may be text, a transcribed voice note, an image (with optional caption), " +
        "or — if you provide inline callback buttons — the callbackData of the button the user tapped. " +
        "Supports HTML/MarkdownV2 formatting and inline URL + callback buttons. " +
        "Returns the user's reply as MCP content blocks.",
      inputSchema: {
        question: z.string().describe("Question body. Format depends on parseMode."),
        parseMode: parseModeSchema,
        disableLinkPreview: disableLinkPreviewSchema,
        buttons: z
          .array(z.array(z.union([urlButtonSchema, callbackButtonSchema])))
          .optional()
          .describe(
            "Inline keyboard rendered under the question. Outer array = rows, inner array = buttons in that row. " +
              "Mix URL buttons (open links) and callback buttons (tap returns callbackData as the reply). " +
              "The user can still reply with free-form text/voice/image even when buttons are present.",
          ),
      },
    },
    async ({ question, parseMode, disableLinkPreview, buttons }, extra) => {
      const { chat_id } = currentUser();
      const notify: Notify = (text) => {
        void extra
          .sendNotification({
            method: "notifications/message",
            params: { level: "info", logger: "metro-ask", data: text },
          })
          .catch(() => {});
      };
      // The Anthropic proxy drops idle SSE streams in ~10 s, so push a
      // debug-level notification every 5 s. Bytes keep the stream alive at
      // the HTTP layer; debug level keeps clients from rendering them.
      const heartbeat = setInterval(() => {
        void extra
          .sendNotification({
            method: "notifications/message",
            params: { level: "debug", logger: "metro-ask", data: "ping" },
          })
          .catch(() => {});
      }, 5_000);
      try {
        const content = await ask(chat_id, question, { parseMode, disableLinkPreview, buttons }, notify);
        return { content };
      } finally {
        clearInterval(heartbeat);
      }
    },
  );

  return s;
}
