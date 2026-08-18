/* Margin and Mission — self-contained session server.
   Serves the app AND stores each session's shared state.
   No dependencies. Requires Node.js 18+.  Run:  node server.js
   Then open the printed URL on every device (same network).           */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const DIR  = __dirname;
const DBFILE = path.join(DIR, 'session-store.json');

// ── tiny key/value store, persisted to a JSON file ──────────────
let store = {};
try { store = JSON.parse(fs.readFileSync(DBFILE, 'utf8')); } catch (e) {}
let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => fs.writeFile(DBFILE, JSON.stringify(store), () => {}), 150);
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript',
               '.css':'text/css', '.json':'application/json', '.md':'text/markdown' };

http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  // ── key/value API ──────────────────────────────────────────
  if (p.startsWith('/kv/')) {
    const key = decodeURIComponent(p.slice(4));
    if (req.method === 'GET') {
      if (Object.prototype.hasOwnProperty.call(store, key)) {
        res.writeHead(200, { 'Content-Type':'application/json' });
        return res.end(JSON.stringify({ value: store[key] }));
      }
      res.writeHead(404); return res.end();
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
      req.on('end', () => {
        try { store[key] = JSON.parse(body).value; persist();
              res.writeHead(200, {'Content-Type':'application/json'}); res.end('{"ok":true}'); }
        catch (e) { res.writeHead(400); res.end('{"error":"bad json"}'); }
      });
      return;
    }
    if (req.method === 'DELETE') {
      delete store[key]; persist();
      res.writeHead(200, {'Content-Type':'application/json'}); return res.end('{"ok":true}');
    }
    res.writeHead(405); return res.end();
  }

  // ── wipe the whole session (facilitator "reset" also does per-key) ──
  if (p === '/reset' && req.method === 'POST') {
    store = {}; persist();
    res.writeHead(200, {'Content-Type':'application/json'}); return res.end('{"ok":true}');
  }

  // ── static files (the app) ─────────────────────────────────
  let rel = p === '/' ? '/index.html' : p;
  const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(DIR, safe);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  const nets = require('os').networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets))
    for (const n of nets[name]) if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
  console.log('\n  Margin and Mission — server running');
  console.log('  ------------------------------------');
  console.log('  This computer:   http://localhost:' + PORT);
  ips.forEach(ip => console.log('  Other devices:   http://' + ip + ':' + PORT + '   (same wifi/LAN)'));
  console.log('\n  Give every laptop the same "Other devices" URL. Ctrl+C to stop.\n');
});
