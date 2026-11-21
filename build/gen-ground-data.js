'use strict';
/**
 * ~/.cache/osm/*.json -> data/GROUND.json（滑行道/机坪/机场边界/跑道兜底）
 * 数据：© OpenStreetMap contributors (ODbL)
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const CACHE = path.join(process.env.HOME, '.cache/osm');

const num = v => { const n = parseFloat(String(v || '').replace(/[^\d.]/g, '')); return isFinite(n) ? Math.round(n) : 0; };
function clean(geo) {
  const out = [];
  let last = null;
  for (const p of geo) {
    const q = [+p.lat.toFixed(5), +p.lon.toFixed(5)];
    if (last && q[0] === last[0] && q[1] === last[1]) continue;
    out.push(q); last = q;
    if (out.length >= 300) break;
  }
  return out;
}
function simplify(pts) {
  // 抽稀：相邻点距离过近就丢（约 8m）
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i];
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) > 1.6e-4) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const ap = {};
let airports = 0, nTwy = 0, nApron = 0, nAd = 0, nRwy = 0, dropped = 0;
for (const f of fs.readdirSync(CACHE)) {
  if (!/^[A-Z]{4}\.json$/.test(f)) continue;
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch (e) { continue; }
  const id = j.id;
  const o = {};
  for (const w of j.ways || []) {
    const t = w.tags || {}, k = t.aeroway;
    let pts = clean(w.geometry || []);
    if (pts.length < 2) { dropped++; continue; }
    if (k === 'taxiway' || k === 'taxilane') {
      pts = simplify(pts);
      (o.twy = o.twy || []).push({ p: pts, w: num(t.width) || 18, rf: t.ref || '' });
      nTwy++;
    } else if (k === 'apron') {
      (o.apron = o.apron || []).push({ p: pts });
      nApron++;
    } else if (k === 'aerodrome') {
      (o.ad = o.ad || []).push(pts);
      nAd++;
    } else if (k === 'runway') {
      (o.rwy = o.rwy || []).push({ p: pts, w: num(t.width) || 0, rf: t.ref || t.name || '' });
      nRwy++;
    }
  }
  if (o.twy || o.apron || o.ad || o.rwy) { ap[id] = o; airports++; }
}
const out = { src: '© OpenStreetMap contributors (ODbL)', ap };
const file = path.join(root, 'data/GROUND.json');
fs.writeFileSync(file, JSON.stringify(out));
console.log(`airports=${airports} twy=${nTwy} apron=${nApron} ad=${nAd} rwy=${nRwy} dropped=${dropped} size=${(fs.statSync(file).size / 1024).toFixed(0)}KB`);
