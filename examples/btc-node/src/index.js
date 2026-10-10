const PRICE_URL = 'https://api.coinbase.com/v2/prices/BTC-USD/spot';
const SIGNATURE_SCHEME = 'stage-node-v1';
const MAX_CLOCK_SKEW_SECONDS = 300;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Stage-Key, Stage-Timestamp, Stage-Signature',
  'Access-Control-Max-Age': '86400',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function base64urlBytes(text) {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function signatureIsValid(key, signature, message) {
  try {
    const publicKey = await crypto.subtle.importKey('raw', base64urlBytes(key), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'Ed25519' }, publicKey, base64urlBytes(signature), new TextEncoder().encode(message));
  } catch {
    return false;
  }
}

async function widgetKey(request, body) {
  const key = request.headers.get('Stage-Key');
  const timestamp = request.headers.get('Stage-Timestamp');
  const signature = request.headers.get('Stage-Signature');
  if (!key || !timestamp || !signature) return null;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_CLOCK_SKEW_SECONDS) return null;
  const message = [SIGNATURE_SCHEME, request.method, request.url, timestamp, await sha256Hex(body)].join('\n');
  return await signatureIsValid(key, signature, message) ? key : null;
}

async function btcPrice() {
  try {
    const response = await fetch(PRICE_URL, { headers: { Accept: 'application/json' } });
    const { data } = await response.json();
    const price = Number(data.amount);
    return Number.isFinite(price) ? price : null;
  } catch {
    return null;
  }
}

function priceText(price) {
  if (price === null) return 'Unavailable';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(price);
}

function priceWidget(price, now) {
  return {
    type: 'Card',
    size: 'sm',
    children: [
      {
        type: 'Row',
        children: [
          { type: 'Caption', value: 'Bitcoin', size: 'sm' },
          { type: 'Spacer' },
          { type: 'Badge', label: 'BTC / USD', color: 'secondary' },
        ],
      },
      { type: 'Title', value: priceText(price), size: '3xl' },
      { type: 'Caption', value: `Updated ${now.toISOString().slice(11, 19)} UTC` },
      {
        type: 'Row',
        children: [
          { type: 'Button', label: 'Refresh', iconStart: 'reload', variant: 'outline', size: 'sm', onClickAction: { type: 'refresh' } },
        ],
      },
    ],
  };
}

function actionOf(body) {
  try {
    return JSON.parse(body)?.params?.action ?? null;
  } catch {
    return null;
  }
}

async function answerAction(key, body) {
  if (actionOf(body)?.type !== 'refresh') return json({});
  const now = new Date();
  const widget = priceWidget(await btcPrice(), now);
  return json({ updated_item: { id: key, thread_id: key, created_at: now.toISOString(), type: 'widget', widget } });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'Use GET or POST' }, 405);
    const body = request.method === 'POST' ? await request.text() : '';
    const key = await widgetKey(request, body);
    if (key === null) return json({ error: 'Missing or invalid Stage signature' }, 401);
    if (request.method === 'POST') return answerAction(key, body);
    return json(priceWidget(await btcPrice(), new Date()));
  },
};
