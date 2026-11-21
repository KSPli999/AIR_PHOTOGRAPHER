'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const f = path.join(process.env.HOME, '全国机场跑道与频率.html');
http.createServer((req, res) => {
  if (req.url === '/' || req.url.startsWith('/?')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(f));
  } else { res.writeHead(404); res.end('not found'); }
}).listen(3112, '127.0.0.1', () => console.log('http://127.0.0.1:3112'));
