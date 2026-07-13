const CHAT_URL = 'https://routerai.ru/api/v1/chat/completions';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

async function fetchCalendHolidays(d) {
  const [y, m, day] = d.split('-').map(Number);
  const url = `https://www.calend.ru/day/${y}-${m}-${day}/`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'FocusSync/1.0 (Bot)' },
  });
  if (!resp.ok) return [];
  const html = await resp.text();

  // Extract the holidays block
  const blockMatch = html.match(/class="block holidays">([\s\S]*?)<\/ul>\s*<\/div>/);
  if (!blockMatch) return [];
  const block = blockMatch[1];

  // Parse holiday names from title spans
  const names = [];
  const re = /<span class="title"><a href="[^"]*">([^<]+)<\/a><\/span>/g;
  let match;
  while ((match = re.exec(block)) !== null) {
    const name = match[1].trim();
    if (name && name.length > 3 && name.length < 100) names.push(name);
  }
  return [...new Set(names)];
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // Calend.ru holiday parser
    if (url.searchParams.has('holiday')) {
      const d = url.searchParams.get('d');
      if (!d) return new Response('Missing ?d=YYYY-MM-DD', { status: 400, headers: corsHeaders(origin) });
      try {
        const holidays = await fetchCalendHolidays(d);
        return new Response(JSON.stringify(holidays), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      } catch (e) {
        return new Response('[]', { headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } });
      }
    }

    // RouterAI chat proxy
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body;
    try { body = await request.json(); }
    catch { return new Response('Invalid JSON', { status: 400 }); }

    const upstream = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + env.ROUTERAI_KEY,
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
