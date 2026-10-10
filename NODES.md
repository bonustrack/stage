# Stage nodes

A node is any HTTPS URL that answers with [OpenAI ChatKit](https://openai.github.io/chatkit-js/) widget JSON, the same JSON a Stage frame shows. Stage turns it into a live widget on the Dashboard (Settings, Dashboard, Add from URL). No agent is involved: the app talks to the node directly. A node can run anywhere, and Stage can also host one for you (see Hosted nodes).

## Load

`GET <url>`, signed (see Signing). Answer `200` with JSON, one of:

- a ChatKit widget root: `{"type": "Card", "children": [...]}` (or `ListView`, `Basic`; other types are refused);
- a ChatKit widget item: `{"type": "widget", "widget": {...}}`;
- a Stage frame: `{"title": "...", "widget": {...}}` or `{"screens": {...}, "start": "..."}`.

Stage loads it when the widget shows, then every minute while the Dashboard is open and the app is in front. After a failure it waits longer, up to 5 minutes. Offline or on an error, the widget keeps the last good version and its header says why and since when.

## Actions

A button (`onClickAction`), a form submit (`onSubmitAction`) or a field change (`onChangeAction`) sends ChatKit's own sync action request:

```http
POST <url>
Content-Type: application/json

{"type": "threads.sync_custom_action", "params": {"thread_id": "<key id>", "item_id": "<key id>", "action": {"type": "refresh", "payload": {}}}}
```

`action` is the widget's ActionConfig `type` and `payload`. Form values are merged into `payload` by field name, as in ChatKit: dotted names nest and keys already in the payload win. Stage has no threads, so `thread_id` and `item_id` are both the widget's key id (the `Stage-Key` header). `handler` and `loadingBehavior` are ignored: the tapped button shows its own loading state until the reply.

Answer like a ChatKit `sync_action()` handler, with a `SyncCustomActionResponse`:

```json
{"updated_item": {"type": "widget", "widget": {"type": "Card", "children": []}}}
```

Stage shows the new widget at once. `{}`, `{"updated_item": null}` or an empty `204` keep the current widget. Any reply accepted by Load works too, but an `updated_item` that is not a widget item is refused. So a ChatKit server can serve a node by passing `params.action` to its action handler and returning the serialized response.

## Signing

Every request carries three headers:

| Header | Value |
|---|---|
| `Stage-Key` | the widget's Ed25519 public key, 32 bytes, base64url without padding |
| `Stage-Timestamp` | Unix time in seconds |
| `Stage-Signature` | Ed25519 signature, 64 bytes, base64url without padding |

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
- No cookies or credentials, no referrer, no redirects, a 10 second timeout and replies up to 128 KB (reading stops there). Action requests are at most 16K characters. On phones, a host name must be plain ASCII (use the `xn--` form for international names).
- The reply passes the same checks as a frame: at most 64K characters of widget JSON, depth 16, 500 nodes, `https` images only. No code from a node runs in Stage.
- The widget header shows the node's host.
- In browsers the node must answer CORS: `Access-Control-Allow-Origin: *` on every response, and `OPTIONS` with `Access-Control-Allow-Methods: GET, POST, OPTIONS` and `Access-Control-Allow-Headers: Content-Type, Stage-Key, Stage-Timestamp, Stage-Signature`. Hosted nodes get this from `nodes.stage.box`.

## Hosted nodes

Stage can put a node online for you. In the app: Settings, Dashboard, Add from URL, Code. Paste the code, tap Publish, and Stage shows the node at `https://nodes.stage.box/<id>` with its preview, then adds it as a widget. Anyone with the link can call it, like any node.

The code is one ES module of at most 64 KB whose default export has a `fetch` handler, as in a Cloudflare Worker:

```js
const card = (time) => ({
  type: 'Card',
  children: [
    { type: 'Text', value: time },
    { type: 'Button', label: 'Refresh', onClickAction: { type: 'refresh' } },
  ],
});

export default {
  async fetch(request) {
    const time = new Date().toISOString();
    if (request.method === 'POST') return Response.json({ updated_item: { type: 'widget', widget: card(time) } });
    return Response.json(card(time));
  },
};
```

Each node runs as its own Worker in a Cloudflare Workers for Platforms dispatch namespace, isolated from the other nodes and from Stage:

- No bindings, secrets or environment, and no shared cache.
- `fetch` reaches public `https` host names on the default port only: no IP addresses, local names or `*.stage.box`, and a redirect comes back to the code instead of being followed. Raw TCP sockets are off.
- Per call: 50 ms of CPU, 5 subrequests and 10 seconds in all.
- Requests arrive as Stage sent them, signature headers included, so a hosted node can check `Stage-Key` like any other. Cookies and the caller's IP address and location headers are removed first, so a hosted node never sees the user's IP.
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

## Frames from chats

A frame message can name its node with `source`: `{"widget": {...}, "source": {"url": "https://..."}}`. Add to dashboard on that frame first asks, naming the node's host, then adds a live widget for that URL with a new key. The bubble in the chat stays as it was sent, and apps that do not know `source` ignore it.

## Limits

- The node sees the device's IP address and what Stage sends it, as with an image in a frame. A hosted node does not see the IP address.
- Stage checks the host name, not the address DNS returns, so a public name that points to a private address is not caught.
- A captured request can be replayed for up to 5 minutes. A node that needs more can reject a signature it has already seen.
