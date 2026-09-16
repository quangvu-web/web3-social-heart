import http from 'node:http';

const port = Number(process.env.PORT || 8080);
const functionBaseUrl = (process.env.SUPABASE_LIVE_RTMP_FUNCTION_URL || '').replace(/\/+$/, '');
const callbackSecret = process.env.RTMP_CALLBACK_SECRET || '';

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    send(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'POST') {
    send(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (!functionBaseUrl || !callbackSecret) {
    send(res, 500, { error: 'Callback proxy is not configured' });
    return;
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', async () => {
    try {
      const body = Buffer.concat(chunks);
      const target = `${functionBaseUrl}${req.url}`;
      const upstream = await fetch(target, {
        method: 'POST',
        headers: {
          'content-type': req.headers['content-type'] || 'application/x-www-form-urlencoded',
          'x-rtmp-secret': callbackSecret,
        },
        body,
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') || 'application/json' });
      res.end(text);
    } catch (error) {
      send(res, 502, { error: error instanceof Error ? error.message : 'Callback proxy failed' });
    }
  });
});

server.listen(port, () => {
  console.log(`RTMP callback proxy listening on ${port}`);
});
