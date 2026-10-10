# Stage nodes

A node is any HTTPS URL that answers with [OpenAI ChatKit](https://openai.github.io/chatkit-js/) widget JSON, the same JSON a Stage frame shows. Stage turns it into a live widget on the Dashboard (Settings, Dashboard, Add from URL). No agent and no Stage server are involved: the app talks to the node directly.

## Load

`GET <url>`, signed (see Signing). Answer `200` with JSON, one of:

- a ChatKit widget root: `{"type": "Card", "children": [...]}` (or `ListView`, `Basic`);
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

Stage shows the new widget at once. `{}`, `{"updated_item": null}` or an empty `204` keep the current widget. Any reply accepted by Load works too. So a ChatKit server can serve a node by passing `params.action` to its action handler and returning the serialized response.

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

`<URL>` is the full URL as requested (scheme, host, path and query, no fragment), which a Worker reads as `request.url`. To verify: reject a timestamp more than 5 minutes away from now, rebuild the text, then check the signature with the public key. WebCrypto `{ name: 'Ed25519' }` does this in Workers, Node, Bun and browsers. See `widgetKey` in `examples/btc-node/src/index.js`.

Each widget gets its own key, made on the device and synced only through the owner's end-to-end encrypted self-sync. A node learns which widget is calling, never who the user is. A private node can keep a list of the keys it accepts.

Test vector, with the RFC 8032 test 1 key:

- secret key `9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60`
- `Stage-Key: 11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo`
- `GET https://btc.example.com/` with `Stage-Timestamp: 1760000000`
- `Stage-Signature: LZX_kFDKueYoejNdCwxJNrvgZTwUjbC5zhQQqmW5ZMddbw5aXhRfi0WHRilqi7ZW89G8eNza0AxVUde4iQu1CQ`

## What Stage enforces

- `https` only, and no user name or password in the URL.
- No local names (`localhost`, `.local`, `.internal`, `.lan`, `.home.arpa`, names without a dot) and no private, loopback, link-local, shared (100.64/10) or multicast IP addresses.
- No cookies or credentials, no referrer, no redirects, a 10 second timeout and replies up to 128 KB. Action requests are at most 16K characters.
- The reply passes the same checks as a frame: at most 64K characters of widget JSON, depth 16, 500 nodes, `https` images only. No code from a node runs in Stage.
- The widget header shows the node's host.
- In browsers the node must answer CORS: `OPTIONS` with `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, POST, OPTIONS` and `Access-Control-Allow-Headers: Content-Type, Stage-Key, Stage-Timestamp, Stage-Signature`.

## Frames from chats

A frame message can name its node with `source`: `{"widget": {...}, "source": {"url": "https://..."}}`. Add to dashboard on that frame then adds a live widget for that URL with a new key. The bubble in the chat stays as it was sent, and apps that do not know `source` ignore it.

## Examples

- [`examples/btc-node`](examples/btc-node): a Cloudflare Worker with the BTC price and a Refresh button, and a Deploy to Cloudflare button.
- `https://proxy.stage.box/nodes/eth-price`: the ETH price node Stage hosts itself on its proxy Worker ([`apps/proxy/src/ethNode.ts`](apps/proxy/src/ethNode.ts)). It does not check signatures because the price is public.

## Limits

- The node sees the device's IP address and what Stage sends it, as with an image in a frame.
- Stage checks the host name, not the address DNS returns, so a public name that points to a private address is not caught.
- A captured request can be replayed for up to 5 minutes. A node that needs more can reject a signature it has already seen.
