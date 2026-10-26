# Stage nodes

A node is any HTTPS URL that answers with [A2UI v1.0](https://a2ui.org) messages, the same messages a Stage frame carries. Stage turns it into a live widget on the Dashboard (Dashboard, Add from URL), and a frame sent in a chat can name its node too (see Frames in chats). No agent is involved: the app talks to the node directly. A node can run anywhere, and Stage can also host one for you (see Hosted nodes).

## Load

`GET <url>`, signed (see Signing). Answer `200` with A2UI v1.0 server messages: a JSON array, `{"messages": [...]}`, a single message, or one message per line (JSON Lines). Only `createSurface`, `updateComponents`, `updateDataModel` and `deleteSurface` are allowed, and at least one surface must end up with a `root` component. Any other body is refused.

```json
[{"version": "v1.0", "createSurface": {
  "surfaceId": "main",
  "catalogId": "https://kit.stage.box/a2ui/v1_0/catalog.json",
  "dataModel": {"price": "$64,210"},
  "components": [
    {"id": "root", "component": "Card", "child": "col"},
    {"id": "col", "component": "Column", "children": ["title", "price", "refresh"]},
    {"id": "title", "component": "Title", "text": "BTC"},
    {"id": "price", "component": "Text", "text": {"@path": "/price"}},
    {"id": "label", "component": "Text", "text": "Refresh"},
    {"id": "refresh", "component": "Button", "child": "label", "action": {"event": {"name": "refresh"}}}
  ]
}}]
```

To stream, answer with `Content-Type: application/jsonl` (or `application/x-ndjson`) and one message per line, flushed as you go: Stage reads the reply as it arrives, applies each line at once and shows the frame as soon as a surface has a root, so a slow part does not hold back the rest. Until then the widget keeps showing what it had. The same works for replies to renderer messages. Other replies are read whole, then applied in order. Either way, a bad line stops the reply there, and the limits below count the whole reply.

Use the A2UI basic catalog (`https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json`) or the Stage Kit catalog (`https://kit.stage.box/a2ui/v1_0/catalog.json`), which is the basic catalog plus Stage's design tokens, icons and a few extra components (Title, Badge, ListView, Spinner, QrCode). Stage validates every message against its catalog and drops the ones that do not pass.

A node can create several surfaces. The first one shows (or the one a chat frame names in `start`). A button whose action calls the Kit catalog function `openSurface` with another surface id opens it as a new screen with a back button, and `closeSurface` goes back:

```json
{"id": "more", "component": "Button", "child": "moreLabel", "action": {"functionCall": {"@call": "openSurface", "args": {"surfaceId": "details"}}}}
```

Stage loads it when the widget shows, then every minute while the Dashboard is open and the app is in front. After a failure it waits longer, up to 5 minutes. Offline or on an error, the widget keeps the last good version and its header says why and since when.

The menu of a live widget (the three dots) has Refresh, which loads the node again at once, and Copy link. A node does not need a Refresh button of its own.

## Renderer messages

Everything the A2UI renderer sends is POSTed to the node, signed, one message per request, as is:

- `action`: a component with an event action (a Button, a ListViewItem) was used.
- `callAgentFunction`: a component evaluates a function its catalog declares but Stage does not implement, which A2UI routes to the agent under its own name. The basic and Kit catalogs declare none today, so this comes into play once a catalog Stage renders declares agent functions. The value shows as pending until the node answers, and a component asks once per name and arguments.
- `rendererFunctionResponse`: the answer to a `callRendererFunction` the node sent.
- `error`: a message from the node failed validation (`VALIDATION_FAILED`, `UNALLOWED_PARENT`, `UNALLOWED_CHILD`, ...).

```http
POST <url>
Content-Type: application/json

{"version": "v1.0", "action": {"name": "refresh", "surfaceId": "main", "sourceComponentId": "refresh", "timestamp": "2026-10-26T12:00:00.000Z", "context": {}}, "metadata": {"a2uiRendererCapabilities": {"v1.0": {"supportedCatalogIds": ["https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json", "https://kit.stage.box/a2ui/v1_0/catalog.json"]}}}}
```

An action's `context` holds the event's resolved `context`, so data-bound values such as form fields arrive with it. `metadata.a2uiRendererCapabilities` lists the catalogs Stage renders, on every message; the same JSON comes in the `Stage-A2UI-Capabilities` header of every request, loads included. A surface created with `"sendDataModel": true` also sends its whole data model, the A2UI way, in `metadata.a2uiRendererDataModel`: `{"version": "v1.0", "surfaces": {"main": {...}}}`. The key id (the `Stage-Key` header) tells the node which widget is calling.

Answer with A2UI messages, in any of the Load formats: the surface messages, plus `agentFunctionResponse` (`{"functionCallId": "...", "value": ...}` or `"error": {"code", "message"}`) to answer a `callAgentFunction`, and `callRendererFunction` to have Stage run one of its catalog functions and answer with a `rendererFunctionResponse` (only functions whose `allowedCallers` let the agent call them run: in the Kit catalog `formatString`, `formatNumber`, `formatCurrency`, `formatDate` and `pluralize`; everything else, `openSurface` and `closeSurface` included, answers `INVALID_FUNCTION_CALL`). Stage applies them to the frame as shown, local edits and pending calls included, and shows the result at once. `[]`, `{}` or an empty body change nothing. A reply that leaves no surface to show is refused. A frame without a node answers every `callAgentFunction` with an `UNKNOWN_FUNCTION` error, so nothing waits forever.

## Signing

Every request carries three signing headers:

| Header | Value |
|---|---|
| `Stage-Key` | the widget's Ed25519 public key, 32 bytes, base64url without padding |
| `Stage-Timestamp` | Unix time in seconds |
| `Stage-Signature` | Ed25519 signature, 64 bytes, base64url without padding |

The `Stage-A2UI-Capabilities` header is informational and not signed.

The signature covers these five lines joined with `\n`, in UTF-8, with no trailing newline:

```text
stage-node-v1
<METHOD>
<URL>
<Stage-Timestamp>
<SHA-256 of the raw body as lowercase hex, of an empty body for GET>
```

`<URL>` is the full URL as requested (scheme, host, path and query, no fragment), which a Worker reads as `request.url`. Stage normalizes it first the way Cloudflare does: escaped letters, digits and `-._~` are decoded, other escapes use uppercase hex, and characters such as `|` and `^` are escaped. To verify: reject a timestamp more than 5 minutes away from now, rebuild the text, then check the signature with the public key. WebCrypto `{ name: 'Ed25519' }` does this in Workers, Node, Bun and browsers.

Each widget gets its own key, made on the device and synced only through the owner's end-to-end encrypted self-sync. A node learns which widget is calling, never who the user is. A private node can keep a list of the keys it accepts.

Test vector, with the RFC 8032 test 1 key:

- secret key `9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60`
- `Stage-Key: 11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo`
- `GET https://btc.example.com/` with `Stage-Timestamp: 1760000000`
- `Stage-Signature: LZX_kFDKueYoejNdCwxJNrvgZTwUjbC5zhQQqmW5ZMddbw5aXhRfi0WHRilqi7ZW89G8eNza0AxVUde4iQu1CQ`

## What Stage enforces

- `https` only, and no user name or password in the URL.
- No local names (`localhost`, `.local`, `.internal`, `.lan`, `.home.arpa`, names without a dot) and no private, loopback, link-local, shared (100.64/10) or multicast IP addresses.
- No cookies or credentials, no referrer, no redirects, a 10 second timeout and replies up to 128 KB (reading stops there). POST requests are at most 16K characters. On phones, a host name must be plain ASCII (use the `xn--` form for international names).
- The reply passes the same checks as a frame: at most 200 messages, 64K characters of JSON and 500 components; messages that fail their catalog schema are dropped and a reply that leaves nothing to show is refused; `https` media only. No code from a node runs in Stage: A2UI functions are the catalog's own, run by Stage.
- The widget header shows the node's host.
- In browsers the node must answer CORS: `Access-Control-Allow-Origin: *` on every response, and `OPTIONS` with `Access-Control-Allow-Methods: GET, POST, OPTIONS` and `Access-Control-Allow-Headers: Content-Type, Stage-Key, Stage-Timestamp, Stage-Signature, Stage-A2UI-Capabilities`. Hosted nodes get this from `nodes.stage.box`.

## Hosted nodes

Stage can put a node online for you. In the app: Dashboard, Add from URL, Code. Paste the code, tap Publish, and Stage shows the node at `https://nodes.stage.box/<id>` with its preview, then adds it as a widget. Anyone with the link can call it, like any node.

The code is one ES module of at most 64 KB, with no `import`, whose default export has a `fetch` handler, as in a Cloudflare Worker:

```js
export default {
  async fetch() {
    return Response.json([{ version: 'v1.0', createSurface: {
      surfaceId: 'main', catalogId: 'https://kit.stage.box/a2ui/v1_0/catalog.json',
      components: [{ id: 'root', component: 'Text', text: new Date().toISOString() }],
    } }]);
  },
};
```

Each node runs as its own Worker in a Cloudflare Workers for Platforms dispatch namespace, isolated from the other nodes and from Stage:

- No bindings, secrets or environment, and no shared cache.
- `fetch` reaches public `https` host names on the default port only: no IP addresses, local names or `*.stage.box`, and a redirect comes back to the code instead of being followed. Cloudflare `cf` options on a `fetch` are dropped. Raw TCP sockets are off.
- A node can not call itself: `ctx.exports` is off and the code can not `import` (so no `cloudflare:workers` or `cloudflare:sockets`), since a call to itself would skip these limits.
- Per call: 50 ms of CPU, 5 subrequests and 10 seconds in all.
- Requests arrive as Stage sent them, signature headers included, so a hosted node can check `Stage-Key` like any other. Cookies and the caller's IP address and location headers are removed first, so a hosted node never sees the user's IP. Images in its reply still load from the device, so the sites that serve them do see it.
- `nodes.stage.box` answers CORS itself and allows only `GET` and `POST`, with bodies of at most 64 KB, 120 calls a minute per IP (an IPv6 address counts by its /64), 600 calls a minute per node, and no calls from other Workers.
- The reply keeps the node's status and body, at most 128 KB, and always goes out as `application/json` with no cookies or other headers. A redirect answers `502`, as does a crash or a hit limit; an unknown node answers `404`.

Publishing is a signed request to the proxy, the same scheme as in Signing. The app does it for you:

```http
PUT https://proxy.stage.box/nodes
Content-Type: application/javascript
Stage-Key: ...
Stage-Timestamp: ...
Stage-Signature: ...

<the code>
```

The signature covers the raw bytes of the code as sent. It answers `{"id": "<id>", "url": "https://nodes.stage.box/<id>"}`. The id is the first 16 bytes of the SHA-256 of the 32 byte public key, as lowercase hex, so a key owns exactly one node (weak, small order keys are refused): a new `PUT` with the same key replaces the code, and a signed `DELETE https://proxy.stage.box/nodes` with no body removes the node. Nobody else can change or remove it. The app makes a new key for each node and its widget signs with that same key, so removing the widget also deletes the node.

Errors: `400` the code was refused (the reason is in `error`), `401` a bad or stale signature, `411` no length, `413` more than 64 KB, `429` rate limited (10 a minute per IP or IPv6 /64, 60 a minute in all), `503` node hosting is not set up yet, `507` Stage hosts no more nodes for now (1000 in all).

## Frames in chats

A frame message (content type `stage.box/frame:2.0`) carries A2UI messages, like a node reply, with an optional `title`, `description`, `start` surface and `source`:

```json
{"title": "BTC", "messages": [{"version": "v1.0", "createSurface": {"surfaceId": "main", "catalogId": "https://kit.stage.box/a2ui/v1_0/catalog.json", "components": [...]}}], "source": {"url": "https://..."}}
```

A frame without `source`, or whose `source` is not a node URL Stage calls (see What Stage enforces), is a plain frame: it shows as sent and its actions go to the chat as a frame action message (`stage.box/frameAction:2.0`): `{"frameId": "<frame message id>", "action": {<the A2UI action>}, "label": "<the button text>"}`, plus `dataModel` when the surface sets `sendDataModel`. Frames in the older ChatKit format (`stage.box/frame:1.0`) are no longer read and show their fallback text.

In the chat, the frame shows as it was sent, and Stage calls its node only when someone taps: a button in it, or Refresh in its menu (the three dots above it, next to the node's host). Stage does not call the node before a tap, and nothing works before the chat is accepted. Images in the frame still load when it shows, as in any frame. Calls are signed and checked as on the Dashboard, and every action of a frame with a node goes to that node. The reply updates the frame in place on that device only: no message is sent, and after the app restarts the frame shows as sent again. Each frame signs with its own key, made on the device for that app session.

Add to dashboard, in the frame's menu (the three dots) or in the message menu, first asks, naming the node's host, then adds a live widget for that URL with a new key. On a plain frame, Add to dashboard adds a widget that shows that message as it was sent, and its actions go to that chat.

## Limits

- The node sees the device's IP address and what Stage sends it, as with an image in a frame (in a chat, Stage calls it only after a tap). A hosted node does not see the IP address, but the sites of the images in its reply do.
- Stage checks the host name, not the address DNS returns, so a public name that points to a private address is not caught.
- A captured request can be replayed for up to 5 minutes. A node that needs more can reject a signature it has already seen.
