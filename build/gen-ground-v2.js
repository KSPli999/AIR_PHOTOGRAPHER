'use strict';
/**
 * ~/.cache/osm/*.json -> data/GROUND.json
 * 机场道面：跑道（runway）+ 滑行道（taxiway/taxilane）+ 机坪（apron）
 * 数据：© OpenStreetMap contributors (ODbL)
 * 抽稀：道格拉斯-普克，容差 3m（≈0.000027°），道面形状不受影响
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const CACHE = path.join(process.env.HOME, '.cache/osm');
const num = v => { const n = parseFloat(String(v || '').replace(/[^\d.]/g, '')); return isFinite(n) ? Math.round(n) : 0; };
const EPS = 0.000027;            // ≈3 m

function clean(geo) {
  const out = [];
  let last = null;
  for (const p of geo) {
    const q = [+p.lat.toFixed(6), +p.lon.toFixed(6)];
    if (last && q[0] === last[0] && q[1] === last[1]) continue;
    out.push(q); last = q;
  }
  return out;
}
// 道格拉斯-普克（经纬度直接算，纬度方向误差可忽略）
function simplify(pts, eps = EPS) {
  if (pts.length <= 2) return pts;
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

const ap = {};
let airports = 0, nRwy = 0, nTwy = 0, nApn = 0, nPts = 0;
for (const f of fs.readdirSync(CACHE)) {
  if (!/^[A-Z]{4}\.json$/.test(f)) continue;
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch (e) { continue; }
  const rwy = [], twy = [], apn = [], bd = [];
  for (const w of j.ways || []) {
    const t = w.tags || {};
    const kind = t.aeroway;
    let pts = clean(w.geometry || []);
    if (pts.length < 2) continue;
    const closed = pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
    if (kind === 'runway') {
      const s = simplify([pts[0], pts[pts.length - 1]], 0);   // 跑道只留两端
      rwy.push({ p: s, w: num(t.width) || 0, rf: t.ref || t.name || '' });
      nRwy++; nPts += s.length;
    } else if (kind === 'taxiway' || kind === 'taxilane') {
      pts = simplify(pts);
      if (pts.length < 2) continue;
      twy.push({ p: pts, w: num(t.width) || 0, c: t.taxiway || '' });
      nTwy++; nPts += pts.length;
    } else if (kind === 'aerodrome') {
      if (pts.length < 4) continue;
      pts = simplify(pts, 0.00005);
      if (pts.length >= 4) bd.push({ r: pts });
    } else if (kind === 'apron') {
      if (pts.length < 4) continue;
      pts = simplify(pts);
      if (pts.length < 4) continue;
      apn.push({ r: pts });
      nApn++; nPts += pts.length;
    }
  }
  if (rwy.length || twy.length || apn.length) {
    ap[f.slice(0, 4)] = { rwy, twy, apn, bd };
    airports++;
  }
}
const out = { src: '© OpenStreetMap contributors (ODbL)', ap };
const file = path.join(root, 'data/GROUND.json');
fs.writeFileSync(file, JSON.stringify(out));
console.log(`airports=${airports} rwy=${nRwy} twy=${nTwy} apn=${nApn} pts=${nPts} size=${(fs.statSync(file).size / 1024).toFixed(0)}KB`);
