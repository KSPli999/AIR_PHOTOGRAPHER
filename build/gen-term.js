'use strict';
/**
 * 航站楼轮廓：OSM（© OpenStreetMap contributors, ODbL）
 * 用 OSM 主 API 取机场范围，抽 aeroway=terminal 的闭合 way，3m 抽稀。
 * 缓存：~/.cache/osm-term/<ICAO>.json   输出：data/TERM.json
 * 用法：node build/gen-term.js [--force]
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const CN = JSON.parse(fs.readFileSync(path.join(root, 'data/CN.json'), 'utf8'));
const OUT = path.join(root, 'data/TERM.json');
const CACHE = path.join(process.env.HOME, '.cache/osm-term');
const FORCE = process.argv.includes('--force');
fs.mkdirSync(CACHE, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

function simplify(pts, eps = 0.000027) {
  if (pts.length <= 3) return pts;
  const sq = eps * eps;
  const d2 = (p, a, b) => {
    let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
    if (dx || dy) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
    }
    dx = p[0] - x; dy = p[1] - y;
    return dx * dx + dy * dy;
  };
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop();
    let maxD = -1, idx = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = d2(pts[i], pts[i0], pts[i1]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > sq && idx > 0) { keep[idx] = 1; stack.push([i0, idx], [idx, i1]); }
  }
  const out = [];
  for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

function stitch(parts) {
  const ring = parts.shift().slice();
  while (parts.length) {
    const last = ring[ring.length - 1];
    let best = -1, rev = false, bestD = Infinity;
    for (let i = 0; i < parts.length; i++) {
      const w = parts[i];
      const d0 = Math.hypot(w[0][0] - last[0], w[0][1] - last[1]);
      const d1 = Math.hypot(w[w.length - 1][0] - last[0], w[w.length - 1][1] - last[1]);
      if (d0 < bestD) { bestD = d0; best = i; rev = false; }
      if (d1 < bestD) { bestD = d1; best = i; rev = true; }
    }
    if (best < 0 || bestD > 0.002) break;
    const w = parts.splice(best, 1)[0];
    ring.push(...(rev ? w.slice().reverse() : w).slice(1));
  }
  return ring;
}

function parse(xml) {
  const nodes = new Map();
  for (const m of xml.matchAll(/<node[^>]*\bid="(\d+)"[^>]*\blat="([-\d.]+)"[^>]*\blon="([-\d.]+)"/g)) nodes.set(m[1], [+m[2], +m[3]]);
  const strong = [], weak = [], wayPts = new Map();
  for (const m of xml.matchAll(/<way\b[^>]*>([\s\S]*?)<\/way>/g)) {
    const body = m[1];
    const tags = {};
    for (const t of body.matchAll(/<tag k="([^"]*)" v="([^"]*)"/g)) tags[t[1]] = t[2];
    const aw = (tags.aeroway || '').toLowerCase();
    const bd = (tags.building || '').toLowerCase();
    const name = tags.name || tags['name:zh'] || tags.ref || '';
    const isStrong = aw === 'terminal' || bd === 'terminal';
    const isWeak = !isStrong && !!bd && /航站楼|terminal|Terminal|T\d/i.test(name);
    if (!isStrong && !isWeak) continue;
    const ring = [];
    for (const nd of body.matchAll(/<nd ref="(\d+)"/g)) {
      const p = nodes.get(nd[1]);
      if (p) ring.push([+p[0].toFixed(6), +p[1].toFixed(6)]);
    }
    const widM = /<way\b[^>]*\bid="(\d+)"/.exec(m[0]);
    if (widM) wayPts.set(widM[1], ring);
    if (ring.length < 4) continue;
    const s = simplify(ring);
    if (s.length < 4) continue;
    const rec = { r: s, n: name };
    if (isStrong) strong.push(rec);
    else {
      // 粗算面积（平方米），太小的附属楼不要
      let area = 0;
      for (let i = 0; i < s.length; i++) {
        const a = s[i], b = s[(i + 1) % s.length];
        area += a[1] * b[0] - b[1] * a[0];
      }
      area = Math.abs(area / 2) * 111320 * 111320 * Math.cos(s[0][0] * Math.PI / 180);
      if (area > 2000) weak.push(rec);
    }
  }
  // 航站楼 relation（大机场常见，如首都 T3）
  for (const m of xml.matchAll(/<relation\b[^>]*>([\s\S]*?)<\/relation>/g)) {
    const body = m[1];
    const tags = {};
    for (const t of body.matchAll(/<tag k="([^"]*)" v="([^"]*)"/g)) tags[t[1]] = t[2];
    if (!/terminal/i.test((tags.aeroway || "") + (tags.building || ""))) continue;
    const parts = [];
    for (const mm of body.matchAll(/<member type="way" ref="(\d+)" role="(outer|)"/g)) {
      const pts = wayPts.get(mm[1]);
      if (pts && pts.length > 1) parts.push(pts.slice());
    }
    if (!parts.length) continue;
    const ring = stitch(parts);
    if (ring.length < 4) continue;
    strong.push({ r: simplify(ring), n: tags.name || tags["name:zh"] || "" });
  }
  if (strong.length) return strong;
  return weak.slice(0, 6);
}

async function one(a, attempt = 1, dLat = 0.035, dLon = 0.045) {
  const [la, lo] = a.arp;
  const bbox = [(lo - dLon).toFixed(4), (la - dLat).toFixed(4), (lo + dLon).toFixed(4), (la + dLat).toFixed(4)].join(",");
  try {
    const r = await fetch("https://api.openstreetmap.org/api/0.6/map?bbox=" + bbox, {
      headers: { "user-agent": "skywave-term/1.0 (personal chart)" },
      signal: AbortSignal.timeout(150000),
    });
    if (r.status === 400 && dLat > 0.012) return one(a, attempt, dLat / 2, dLon / 2);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const xml = await r.text();
    const ways = parse(xml);
    fs.writeFileSync(path.join(CACHE, a.id + ".json"), JSON.stringify({ id: a.id, ways }));
    return ways.length;
  } catch (e) {
    if (attempt < 3) { await sleep(4000 * attempt); return one(a, attempt + 1, dLat, dLon); }
    throw e;
  }
}

(async () => {
  const has = id => {
    const f = path.join(CACHE, id + ".json");
    if (!fs.existsSync(f) || fs.statSync(f).size < 10) return false;
    try { return JSON.parse(fs.readFileSync(f, "utf8")).ways.length > 0; } catch (e) { return false; }
  };
  const todo = CN.airports.filter(a => FORCE || !has(a.id));
  console.log("todo", todo.length);
  let done = 0;
  async function worker() {
    while (todo.length) {
      const a = todo.shift();
      try {
        const n = await one(a, 1, 0.035, 0.045);
        console.log(++done, a.id, n);
      } catch (e) {
        console.log(++done, a.id, "ERR", e.message);
      }
      await sleep(400);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  const ap = {};
  let total = 0, pts = 0, empty = [];
  for (const f of fs.readdirSync(CACHE)) {
    if (!/^[A-Z]{4}\.json$/.test(f)) continue;
    const j = JSON.parse(fs.readFileSync(path.join(CACHE, f), "utf8"));
    if (j.ways && j.ways.length) { ap[f.slice(0, 4)] = j.ways; total += j.ways.length; pts += j.ways.reduce((s, w) => s + w.r.length, 0); }
    else empty.push(f.slice(0, 4));
  }
  fs.writeFileSync(OUT, JSON.stringify({ src: "© OpenStreetMap contributors (ODbL)", ap }));
  console.log(`terminals=${total} airports=${Object.keys(ap).length} pts=${pts} size=${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`);
  if (empty.length) console.log("empty:", empty.join(" "));
})();
