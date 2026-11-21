'use strict';
/**
 * 抓取 82 个机场的 OSM 道面要素（跑道/滑行道/机坪/机场边界），缓存到 ~/.cache/osm。
 * 数据：© OpenStreetMap contributors (ODbL)
 * 用法：node build/gen-ground.js [--force]
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(root, 'data/CN.json'), 'utf8'));
const CACHE = path.join(process.env.HOME, '.cache/osm');
fs.mkdirSync(CACHE, { recursive: true });

const EP = 'https://overpass-api.de/api/interpreter';
const force = process.argv.includes('--force');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function q(a) {
  const s = (a.arp[0] - .05).toFixed(4), w = (a.arp[1] - .06).toFixed(4);
  const n = (a.arp[0] + .05).toFixed(4), e = (a.arp[1] + .06).toFixed(4);
  return `[out:json][timeout:60];(` +
    `way["aeroway"~"^(runway|taxiway|apron|aerodrome)$"](${s},${w},${n},${e});` +
    `);out geom;`;
}

async function fetchOne(a, attempt = 1) {
  const body = 'data=' + encodeURIComponent(q(a));
  const ctl = AbortSignal.timeout(120000);
  try {
    const r = await fetch(EP, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'skywave-ground/1.0 (personal chart)' },
      body, signal: ctl
    });
    const txt = await r.text();
    if (!r.ok || !txt.trim().startsWith('{')) throw new Error('HTTP ' + r.status + ' ' + txt.slice(0, 60).replace(/\n/g, ' '));
    const j = JSON.parse(txt);
    const ways = (j.elements || []).filter(x => x.type === 'way' && x.geometry && x.geometry.length > 1);
    fs.writeFileSync(path.join(CACHE, a.id + '.json'), JSON.stringify({ id: a.id, ways }));
    const cnt = {};
    ways.forEach(x => { const k = x.tags.aeroway; cnt[k] = (cnt[k] || 0) + 1; });
    return cnt;
  } catch (e) {
    if (attempt < 4) {
      const wait = 6000 * attempt * attempt;
      console.log(`retry ${a.id} #${attempt} in ${wait / 1000}s: ${e.message}`);
      await sleep(wait);
      return fetchOne(a, attempt + 1);
    }
    throw e;
  }
}

(async () => {
  const list = D.airports.slice();
  let done = 0, fail = 0;
  const stats = [];
  async function worker() {
    while (list.length) {
      const a = list.shift();
      const f = path.join(CACHE, a.id + '.json');
      if (!force && fs.existsSync(f) && fs.statSync(f).size > 60) { done++; continue; }
      try {
        const c = await fetchOne(a);
        done++;
        stats.push(`${a.id} ${JSON.stringify(c)}`);
        console.log(`[${done + fail}/82] ${a.id}`, c);
      } catch (e) {
        fail++;
        console.log(`FAIL ${a.id}: ${e.message}`);
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  fs.writeFileSync(path.join(CACHE, '_stats.json'), JSON.stringify(stats, null, 1));
  console.log(`done=${done} fail=${fail}`);
})();
