import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(join(__dirname, 'public')));

function isAllowedUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'https:') return false;
    const h = url.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return false;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

const rateLimitMap = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const window = 60000;
  const max = 120;
  let entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > window) {
    entry = { start: now, count: 0 };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  return entry.count > max;
}

app.post('/api/proxy', async (req, res) => {
  const ip = req.ip;
  if (rateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const { targetUrl, method = 'GET', headers = {}, body = null } = req.body;
  if (!targetUrl) return res.status(400).json({ error: 'targetUrl is required' });
  if (!isAllowedUrl(targetUrl)) return res.status(403).json({ error: 'URL not allowed (must be HTTPS, non-private)' });

  try {
    const fetchOpts = { method, headers: { ...headers } };
    if (body && method !== 'GET') fetchOpts.body = JSON.stringify(body);
    const upstream = await fetch(targetUrl, fetchOpts);
    const contentType = upstream.headers.get('content-type') || 'application/json';
    const data = await upstream.text();
    res.status(upstream.status).set('Content-Type', contentType).send(data);
  } catch (err) {
    res.status(502).json({ error: `Proxy error: ${err.message}` });
  }
});

app.post('/api/proxy/stream', async (req, res) => {
  const ip = req.ip;
  if (rateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const { targetUrl, method = 'POST', headers = {}, body = null } = req.body;
  if (!targetUrl) return res.status(400).json({ error: 'targetUrl is required' });
  if (!isAllowedUrl(targetUrl)) return res.status(403).json({ error: 'URL not allowed' });

  try {
    const fetchOpts = { method, headers: { ...headers } };
    if (body) fetchOpts.body = JSON.stringify(body);
    const upstream = await fetch(targetUrl, fetchOpts);

    if (!upstream.ok) {
      const errText = await upstream.text();
      res.status(upstream.status).set('Content-Type', 'application/json').send(errText);
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
    } catch (e) {
      // stream interrupted
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: `Stream proxy error: ${err.message}` });
    } else {
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`API Token Key server running at http://localhost:${PORT}`);
});
