'use strict';
/**
 * ~/.cache/osm/*.json -> data/GROUND.json
 * 只保留跑道线位，用于 OurAirports 缺阈值坐标的机场兜底。
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
    const q = [+p.lat.toFixed(6), +p.lon.toFixed(6)];
    if (last && q[0] === last[0] && q[1] === last[1]) continue;
    out.push(q); last = q;
  }
  return out;
}

const ap = {};
let airports = 0, nRwy = 0;
for (const f of fs.readdirSync(CACHE)) {
  if (!/^[A-Z]{4}\.json$/.test(f)) continue;
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch (e) { continue; }
  const rwy = [];
  for (const w of j.ways || []) {
    const t = w.tags || {};
    if (t.aeroway !== 'runway') continue;
    const raw = clean(w.geometry || []);
    if (raw.length < 2) continue;
    rwy.push({ p: [raw[0], raw[raw.length - 1]], w: num(t.width) || 0, rf: t.ref || t.name || '' });
    nRwy++;
  }
  if (rwy.length) { ap[f.slice(0, 4)] = { rwy }; airports++; }
}
const out = { src: '© OpenStreetMap contributors (ODbL)', ap };
const file = path.join(root, 'data/GROUND.json');
fs.writeFileSync(file, JSON.stringify(out));
console.log(`airports=${airports} runways=${nRwy} size=${(fs.statSync(file).size / 1024).toFixed(0)}KB`);
