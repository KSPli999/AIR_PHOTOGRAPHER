'use strict';
/**
 * 桌面版启动器（node app.js 或打包成 exe 后双击运行）
 * - 在 127.0.0.1:3110 启动本地服务
 * - 自动打开默认浏览器
 * - 自动扫描 ./data/*.json 作为可扩展的数据包，注入页面
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { exec } = require('node:child_process');

function findBase() {
  const cands = [path.dirname(process.execPath), __dirname, process.cwd()];
  for (const c of cands) { if (fs.existsSync(path.join(c, "app.html"))) return c; }
  return cands[0];
}
const BASE = findBase();
const HTML = path.join(BASE, 'app.html');
const DATA = path.join(BASE, 'data');
const PORT = Number(process.env.PORT || 3110);

function packsJson() {
  const out = [];
  try {
    for (const f of fs.readdirSync(DATA)) {
      if (!/\.json$/i.test(f)) continue;
      try { out.push(JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))); } catch (e) { console.error('跳过坏文件', f, e.message); }
    }
  } catch (e) { /* 没有 data 目录就不扩展 */ }
  return out;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u === '/' || u === '/index.html') {
    fs.readFile(HTML, (e, b) => e
      ? res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('缺少 app.html，请把 dist/太原空域频率图.html 改名放到程序同目录')
      : (res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }), res.end(b)));
    return;
  }
  if (u === '/packs.json') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(packsJson()));
    return;
  }
  const f = path.join(BASE, path.normalize(u).replace(/^(\.\.[/\\])+/, ''));
  if (!f.startsWith(BASE)) return res.writeHead(403).end();
  fs.readFile(f, (e, b) => {
    if (e) return res.writeHead(404).end('not found');
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(b);
  });
}).listen(PORT, '127.0.0.1', () => {
  const url = 'http://127.0.0.1:' + PORT;
  console.log('山西空域频率图 已启动：' + url + '（关闭本窗口即退出）');
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
});
