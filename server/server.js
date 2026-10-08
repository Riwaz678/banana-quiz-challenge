// Basic HTTP server, only serves the files in client/ for now.
// Built with the Node http module docs: https://nodejs.org/api/http.html
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = path.join(__dirname, '..', 'client');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const urlPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  const relative = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  const filePath = path.join(CLIENT_DIR, relative);

  // stops paths like /../../package.json escaping the client folder
  if (!filePath.startsWith(CLIENT_DIR)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`banana quiz running on http://localhost:${PORT}`);
});
