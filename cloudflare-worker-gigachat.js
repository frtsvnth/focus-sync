const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const CHAT_URL  = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
const SCOPE     = 'GIGACHAT_API_PERS';

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken(authKey) {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }
  const rqUid = crypto.randomUUID();
  const resp = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'RqUID': rqUid,
      'Authorization': `Basic ${authKey}`,
    },
    body: 'scope=' + SCOPE,
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`OAuth failed ${resp.status}: ${t}`);
  }
  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiresAt = data.expires_at ? data.expires_at * 1000 : Date.now() + 29 * 60 * 1000;
  return cachedToken;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body;
    try { body = await request.json(); }
    catch { return new Response('Invalid JSON', { status: 400 }); }

    let token;
    try { token = await getAccessToken(env.GIGACHAT_AUTH_KEY); }
    catch (e) {
      return new Response(JSON.stringify({ error: { message: e.message } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    if (!body.model) body.model = 'GigaChat';

    const upstream = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};