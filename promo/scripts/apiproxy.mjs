// Local relay: http://localhost:4000 -> deployed API through the container's HTTPS proxy.
import http from 'node:http';
import { Readable } from 'node:stream';
const UP = 'https://ca-api.wittyocean-f89cf633.eastus2.azurecontainerapps.io';
http.createServer(async (req, res) => {
  try {
    const headers = { ...req.headers }; delete headers.host; delete headers.connection;
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const r = await fetch(UP + req.url, { method: req.method, headers, body: hasBody ? Readable.toWeb(req) : undefined, duplex: 'half', redirect: 'manual' });
    const h = {}; r.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    res.writeHead(r.status, h);
    if (r.body) Readable.fromWeb(r.body).pipe(res); else res.end();
  } catch (e) { res.writeHead(502); res.end(String(e)); }
}).listen(4000, () => console.log('relay on 4000'));
