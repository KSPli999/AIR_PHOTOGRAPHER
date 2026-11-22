'use strict';
/** 兜底：4 个 OSM 里没标航站楼的机场，取距 ARP 2.5km 内的大体量建筑（面积>1.5万m²） */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const CN = JSON.parse(fs.readFileSync(path.join(root, 'data/CN.json'), 'utf8'));
const CACHE = path.join(process.env.HOME, '.cache/osm-term');
const ids = process.argv.slice(2);
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

function pick(xml, arp) {
  const nodes = new Map();
  for (const m of xml.matchAll(/<node[^>]*\bid="(\d+)"[^>]*\blat="([-\d.]+)"[^>]*\blon="([-\d.]+)"/g)) nodes.set(m[1], [+m[2], +m[3]]);
  const wayPts = new Map();
  const ways = [];
  for (const m of xml.matchAll(/<way\b[^>]*>([\s\S]*?)<\/way>/g)) {
    const body = m[1];
    const tags = {};
    for (const t of body.matchAll(/<tag k="([^"]*)" v="([^"]*)"/g)) tags[t[1]] = t[2];
    const pts = [];
    for (const nd of body.matchAll(/<nd ref="(\d+)"/g)) {
      const p = nodes.get(nd[1]);
      if (p) pts.push(p);
    }
    if (pts.length < 2) continue;
    const wid = /<way\b[^>]*\bid="(\d+)"/.exec(m[0]);
    if (wid) wayPts.set(wid[1], pts);
    if (tags.building || tags.aeroway) ways.push({ tags, pts });
  }
  const out = [];
  // 1) 航站楼 relation（大机场常见）
  for (const m of xml.matchAll(/<relation\b[^>]*>([\s\S]*?)<\/relation>/g)) {
    const body = m[1];
    const tags = {};
    for (const t of body.matchAll(/<tag k="([^"]*)" v="([^"]*)"/g)) tags[t[1]] = t[2];
    if (!/terminal/i.test((tags.aeroway || "") + (tags.building || ""))) continue;
    const parts = [];
    for (const mm of body.matchAll(/<member type="way" ref="(\d+)" role="(outer|)"/g)) {
      const pts = wayPts.get(mm[1]);
      if (pts && pts.length > 1) parts.push(pts);
    }
    if (!parts.length) continue;
    const ring = simplify(stitch(parts)).map(p => [+p[0].toFixed(6), +p[1].toFixed(6)]);
    if (ring.length < 4) continue;
    out.push({ r: ring, n: tags.name || "", strong: true });
  }
  // 2) 普通 way
  for (const w of ways) {
    const isStrong = (w.tags.aeroway || "") === "terminal" || (w.tags.building || "") === "terminal";
    if (!isStrong) continue;
    const ring = simplify(w.pts).map(p => [+p[0].toFixed(6), +p[1].toFixed(6)]);
    if (ring.length >= 4) out.push({ r: ring, n: w.tags.name || "", strong: true });
  }
  // 3) 兜底：大建筑
  if (!out.length) {
    for (const w of ways) {
      if (!w.tags.building) continue;
      const ring = w.pts.map(p => [+p[0].toFixed(6), +p[1].toFixed(6)]);
      if (ring.length < 4) continue;
      let area = 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        area += a[1] * b[0] - b[1] * a[0];
      }
      area = Math.abs(area / 2) * 111320 * 111320 * Math.cos(arp[0] * Math.PI / 180);
      if (area < 15000) continue;
      let cx = 0, cy = 0;
      for (const p of ring) { cy += p[0]; cx += p[1]; }
      cx /= ring.length; cy /= ring.length;
      const dist = Math.hypot((cy - arp[0]) * 111320, (cx - arp[1]) * 111320 * Math.cos(arp[0] * Math.PI / 180));
      if (dist > 2500) continue;
      out.push({ r: ring, n: w.tags.name || "", area });
    }
    out.sort((a, b) => (b.area || 0) - (a.area || 0));
  }
  return out.slice(0, 4).map(o => ({ r: o.r, n: o.n }));
}

(async () => {
  for (const id of ids) {
    const a = CN.airports.find(x => x.id === id);
    if (!a) continue;
    const [la, lo] = a.arp;
    const bbox = [(lo - .03).toFixed(4), (la - .03).toFixed(4), (lo + .03).toFixed(4), (la + .03).toFixed(4)].join(',');
    try {
      const r = await fetch('https://api.openstreetmap.org/api/0.6/map?bbox=' + bbox, {
        headers: { 'user-agent': 'skywave-term/1.0 (personal chart)' }, signal: AbortSignal.timeout(150000)
      });
      const xml = await r.text();
      const ways = pick(xml, a.arp);
      fs.writeFileSync(path.join(CACHE, id + '.json'), JSON.stringify({ id, ways }));
      console.log(id, 'ok', ways.length, ways.map(w => Math.round(w.r.length)));
    } catch (e) { console.log(id, 'ERR', e.message); }
    await sleep(1500);
  }
})();
