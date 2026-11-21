'use strict';
/**
 * 用 OSM 主 API 补齐机场道面（Overpass 太慢时的快路径），写入同一缓存格式。
 * 数据：© OpenStreetMap contributors (ODbL)
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(root, 'data/CN.json'), 'utf8'));
const CACHE = path.join(process.env.HOME, '.cache/osm');
fs.mkdirSync(CACHE, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const K = /^(runway|taxiway|taxilane|apron|aerodrome)$/;

function parse(xml) {
  const nodes = new Map();
  for (const m of xml.matchAll(/<node[^>]*\bid="(\d+)"[^>]*\blat="([-\d.]+)"[^>]*\blon="([-\d.]+)"/g)) {
    nodes.set(m[1], { lat: +m[2], lon: +m[3] });
  }
  const ways = [];
  for (const m of xml.matchAll(/<way\b[^>]*>([\s\S]*?)<\/way>/g)) {
    const body = m[1];
    const tags = {};
    for (const t of body.matchAll(/<tag k="([^"]*)" v="([^"]*)"/g)) tags[t[1]] = t[2];
    if (!K.test(tags.aeroway || '')) continue;
    const geometry = [];
    for (const nd of body.matchAll(/<nd ref="(\d+)"/g)) {
      const n = nodes.get(nd[1]);
      if (n) geometry.push(n);
    }
    if (geometry.length > 1) ways.push({ type: 'way', tags, geometry });
  }
  return ways;
}

async function one(a, attempt = 1) {
  const [la, lo] = a.arp;
  const bbox = [(lo - .033).toFixed(4), (la - .028).toFixed(4), (lo + .033).toFixed(4), (la + .028).toFixed(4)].join(',');
  try {
    const r = await fetch('https://api.openstreetmap.org/api/0.6/map?bbox=' + bbox, {
      headers: { 'user-agent': 'skywave-ground/1.0 (personal chart; contact: local)' },
      signal: AbortSignal.timeout(90000)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const xml = await r.text();
    const ways = parse(xml);
    fs.writeFileSync(path.join(CACHE, a.id + '.json'), JSON.stringify({ id: a.id, ways }));
    return ways.length;
  } catch (e) {
    if (attempt < 3) { await sleep(4000 * attempt); return one(a, attempt + 1); }
    throw e;
  }
}

(async () => {
  const todo = D.airports.filter(a => {
    const f = path.join(CACHE, a.id + '.json');
    return !fs.existsSync(f) || fs.statSync(f).size < 60;
  });
  console.log('todo', todo.length);
  let i = 0, fail = 0;
  async function worker() {
    while (todo.length) {
      const a = todo.shift();
      try {
        const n = await one(a);
        console.log(`[${++i}/${i + fail + todo.length}] ${a.id} ways=${n}`);
      } catch (e) {
        fail++;
        console.log(`FAIL ${a.id} ${e.message}`);
      }
      await sleep(300);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  console.log('fail', fail);
})();
