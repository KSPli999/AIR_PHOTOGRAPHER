'use strict';
/**
 * OurAirports 跑道阈值坐标 -> data/RWY.json（公有领域）
 * 用法：node build/gen-rwy.js
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(root, 'data/CN.json'), 'utf8'));
const CACHE = path.join(process.env.HOME, '.cache/runways.csv');

function parseCSV(t) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c !== '\r') f += c;
    }
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const hav = (a, b) => {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

(async () => {
  if (!fs.existsSync(CACHE) || fs.statSync(CACHE).size < 1000) {
    const r = await fetch('https://davidmegginson.github.io/ourairports-data/runways.csv', { headers: { 'user-agent': 'skywave/1.0' } });
    fs.writeFileSync(CACHE, await r.text());
  }
  const rw = parseCSV(fs.readFileSync(CACHE, 'utf8'));
  const H = rw[0], ix = k => H.indexOf(k);
  const ids = new Set(D.airports.map(a => a.id));
  const out = { src: 'OurAirports runways.csv (public domain)', rwy: {} };
  let n = 0, missing = 0;
  for (const r of rw.slice(1)) {
    const id = r[ix('airport_ident')];
    if (!ids.has(id) || r[ix('closed')] === '1') continue;
    const leLat = +r[ix('le_latitude_deg')], leLon = +r[ix('le_longitude_deg')];
    const heLat = +r[ix('he_latitude_deg')], heLon = +r[ix('he_longitude_deg')];
    if (!leLat || !leLon || !heLat || !heLon) { missing++; continue; }
    const w = Math.round(+r[ix('width_ft')] * 0.3048) || 45;
    const len = Math.round(hav([leLat, leLon], [heLat, heLon]));
    (out.rwy[id] = out.rwy[id] || []).push({
      a: r[ix('le_ident')], b: r[ix('he_ident')],
      le: [+leLat.toFixed(6), +leLon.toFixed(6)],
      he: [+heLat.toFixed(6), +heLon.toFixed(6)],
      w, len
    });
    n++;
  }
  fs.writeFileSync(path.join(root, 'data/RWY.json'), JSON.stringify(out));
  console.log(`airports=${Object.keys(out.rwy).length} runways=${n} skipped(no coords)=${missing} size=${(fs.statSync(path.join(root, 'data/RWY.json')).size / 1024).toFixed(0)}KB`);
})();
