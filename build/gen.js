'use strict';
const fs = require('fs');
const path = require('path');
const dir = __dirname;

const zbyn = JSON.parse(fs.readFileSync(path.join(dir, 'zbyn.json'), 'utf8'));
const app = JSON.parse(fs.readFileSync(path.join(dir, 'apparea.json'), 'utf8'));
const cta = JSON.parse(fs.readFileSync(path.join(dir, 'ctaarea.json'), 'utf8'));

// ---------- coordinate parsing ----------
function parsePt(str) {
  if (!str) return null;
  str = String(str).replace(/\s+/g, ' ').trim();
  // formats: N373655 E1141357  |  N37°44′47″ E112°22′20″  |  N3736E11303  |  N37°45.2′ E112°37.0′
  const m = str.match(/N\s*(\d{2})[°:]?\s*(\d{2})[′':]?\s*(\d{2}(?:\.\d+)?)?[″"']?\s*E\s*(\d{3})[°:]?\s*(\d{2})[′':]?\s*(\d{2}(?:\.\d+)?)?/);
  if (!m) return null;
  const lat = +m[1] + +m[2] / 60 + (m[3] ? +m[3] / 3600 : 0);
  const lon = +m[4] + +m[5] / 60 + (m[6] ? +m[6] / 3600 : 0);
  return [lat, lon];
}
function parseList(text) {
  if (!text) return [];
  // split on "-" separators or newlines, keep N..E.. tokens
  const toks = String(text).split(/[\r\n]+|(?<=E\d{5,6})\s*-\s*|-\s*(?=N\d)/).map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const t of toks) for (const mm of t.matchAll(/N\s*\d{2}[°:]?\s*\d{2}[′':]?\s*\d{2}(?:\.\d+)?[″"']?\s*E\s*\d{3}[°:]?\s*\d{2}[′':]?\s*\d{2}(?:\.\d+)?/g)) {
    const p = parsePt(mm[0]);
    if (p) out.push(p);
  }
  return out;
}

// ---------- deep walk ----------
function walk(v, fn) {
  if (!v || typeof v !== 'object') return;
  if (Array.isArray(v)) { v.forEach((x) => walk(x, fn)); return; }
  fn(v);
  for (const k in v) if (v[k] && typeof v[k] === 'object') walk(v[k], fn);
}

// ---------- CTR / AD 2.17 ----------
const ctr = [];
const ad217 = zbyn.AD_2_17 || {};(ad217.list || []).forEach((o) => {
  const pts = parseList(o.noteLateralLimit);
  if (!pts.length) return;
  ctr.push({
    nameCn: o.designation === 'Taiyuan tower control area' ? '太原塔台管制区' : (o.designation || '').replace('Fuel dumping area', '放油区'),
    nameEn: o.designation,
    vertical: String(o.noteVerticalLimit || '').replace(/\r?\n/g, ' '),
    pts
  });
});

// ---------- TMA 太原进近 ----------
let tma = null;
walk(app, (o) => {
  if (o.nameCn === '太原进近' && !tma && o.lateralLimit) {
    tma = {
      nameCn: o.nameCn,
      nameEn: o.nameEn,
      vertical: 'GND – 5100 m',
      pts: (o.lateralLimit.list || []).map((p) => parsePt(p.value)).filter(Boolean)
    };
  }
});

// ---------- ACC sectors ----------
const sectors = [];
walk(cta, (o) => {
  const sv = o.serviceVO;
  if (!sv || !sv.callSignCn || !o.locationIndicator) return;
  if (sv.callSignCn !== '北京区域') return; // 北京管制区（含太原区域管制室）
  const rc = (sv.radioChannel && sv.radioChannel.list) || [];
  if (!rc.length) return;
  const pts = ((o.lateralLimit && o.lateralLimit.list) || []).map((p) => parsePt(p.value)).filter(Boolean);
    sectors.push({
    nameCn: o.nameCn, nameEn: o.nameEn, loc: o.locationIndicator,
    unit: sv.unitProvidingCn, call: sv.callSignCn,
    tyn: /太原/.test(sv.unitProvidingCn || ''),
    freqs: rc.map((r) => ({ rank: r.rank, f: r.frequency.replace(' MHz', ''), open: r.openTime || '' })),
    vertical: String(o.noteVerticalLimit || '').replace(/\r?\n/g, ' '),
    pts
  });
});

sectors.sort((a, b) => a.nameEn.localeCompare(b.nameEn, 'en', { numeric: true }));

// ---------- comms ----------
const comms = (zbyn.AD_2_18.list || []).map((o) => ({
  type: o.designation, name: o.name || '', cn: o.callSignCn, en: o.callSignEn,
  f: o.frequencyPrimary, alt: o.frequencyAlternate, time: o.workTime
}));

// ---------- navaids ----------
const navs = (zbyn.AD_2_19.list || []).map((o) => ({
  id: o.designator, type: (o.type || '').replace(/\r?\n/g, ' '), cn: o.nameCn,
  f: o.frequency, lat: o.latitude, lon: o.longitude, loc: o.location, note: o.note
}));

// ---------- runways ----------
const arp = [37 + 44.9 / 60, 112 + 37.8 / 60];
const rw = ((zbyn.AD_2_12.runwayDirectionCharacter || {}).list || []).map((r) => ({
  d: r.designator, dim: r.nominalLenWid, hdg: parseFloat(r.magneticBearing), thr: r.elevation
}));

// ---------- output ----------
const out = {
  site: { id: 'ZBYN', nameCn: '太原/武宿', nameEn: 'TAIYUAN/WUSU' },
  cycle: 'EAIP 2026-12 (V1.3)',
  effective: '2026-11-26',
  nextEffective: '2026-12-24',
  arp, magvar: zbyn.AD_2_2.magneticVariation, elev: zbyn.AD_2_2.fieldElevation,
  arpText: zbyn.AD_2_2.coordinate,
  comms, navs, runways: rw, tma, ctr, sectors
};
fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(out, null, 1));
console.log('tma pts', tma && tma.pts.length, '| ctr', ctr.map((c) => c.pts.length), '| sectors', sectors.length, '| comms', comms.length, '| navs', navs.length);
console.log(sectors.map((s) => s.nameEn + ':' + s.freqs.map((x) => x.f).join('/')).join('\n'));
