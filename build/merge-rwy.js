'use strict';
/**
 * 把 eAIP 抽取的跑道/ILS/塔台分跑道数据合进 data/CN.json
 * 用法：node build/merge-rwy.js
 *
 * 输入：data/CN.json（机场+扇区）、data/AIRPORT_RWY.json（gen-rwy-table.js 产物）
 * 输出：data/CN.json（原位更新，新增字段）
 *   airports[].runways[]  + mag, true, surface, pcn, ils{cat,loc,locF,gpF,dme}
 *   airports[].twr[]      + {f, alt, rwys:[跑道端], note, time}
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CN = path.join(ROOT, 'data', 'CN.json');
const RWY = path.join(ROOT, 'data', 'AIRPORT_RWY.json');
const OUT = CN;

const cn = JSON.parse(fs.readFileSync(CN, 'utf8'));
const rwy = JSON.parse(fs.readFileSync(RWY, 'utf8'));
const byIcao = new Map(rwy.airports.map((a) => [a.id, a]));

// “for RWY18R/36L”“Used for RWY02L/20R” → ['18R','36L']
function rwyRefs(note) {
  const out = [];
  const re = /(\d{2})\s*([LRC]?)\s*(?:\/\s*(\d{2})\s*([LRC]?))?/g;
  let m;
  while ((m = re.exec(String(note || '')))) {
    const a = m[1] + (m[2] || '');
    out.push(a);
    if (m[3]) out.push(m[3] + (m[4] || ''));
  }
  return [...new Set(out)];
}

let nRwy = 0, nIls = 0, nTwr = 0;
for (const a of cn.airports) {
  const src = byIcao.get(a.id);
  if (!src) continue;

  // 跑道端补 ILS / 朝向
  for (const r of a.runways || []) {
    const s = (src.runways || []).find((x) => x.rwy === r.d);
    if (!s) continue;
    r.mag = s.mag;
    r.true = s.true;
    r.surface = s.surface;
    r.pcn = s.pcn || '';
    if (s.ils) { r.ils = s.ils; nIls++; }
    nRwy++;
  }

  // 塔台：一机场多套频率时按跑道端归属
  const twrs = (src.comms.TWR || []).map((t) => ({
    f: t.f,
    alt: t.alt || null,
    time: t.time || '',
    note: t.note || '',
    rwys: rwyRefs(t.note),
  }));
  a.twr = twrs;
  nTwr += twrs.length;
}

fs.writeFileSync(OUT, JSON.stringify(cn));
console.log(`merged: ${cn.airports.length} airports | ${nRwy} runway ends | ${nIls} ILS | ${nTwr} TWR freqs`);
console.log('size', (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
// 抽查
const z = cn.airports.find((x) => x.id === 'ZBYN');
console.log(JSON.stringify(z.runways.map((r) => [r.d, r.mag, r.ils && r.ils.cat, r.ils && r.ils.locF])));
console.log(JSON.stringify(z.twr));
