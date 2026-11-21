'use strict';
/**
 * 全国空管频率数据集生成器（EAIP → data/CN.json）
 * 输入（默认 ~/work/eaip）：
 *   AIP.JSON          目录树（取机场列表与顺序）
 *   ad/<ICAO>.js      AD 2 全文本（AD_2_1/2/12/17/18/19）
 *   apparea.json      ENR 2.1.5 进近管制区（含 APxx 扇区频率）
 *   ctaarea.json      ENR 2.1.3 区域管制区扇区（含主备频率）
 * 输出：data/CN.json
 *
 * 用法： node build/gen-national.js [原始数据目录]
 */
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2] || path.join(process.env.HOME, 'work/eaip');
const OUT = path.join(__dirname, '..', 'data', 'CN.json');
const CYCLE = 'EAIP 2026-12 (V1.3)';
const EFFECTIVE = '2026-11-26';
const NEXT_EFFECTIVE = '2026-12-24';

// ---------------- 坐标 ----------------
function toDeg(t, degLen) {
  const raw = String(t).trim();
  const compact = raw.replace(/[°′″'":\s.]/g, '');
  // 紧凑格式 DDMMSS / DDDMMSS（无度分秒符号）
  if (!/[°′″'":]/.test(raw) && compact.length >= degLen + 4 && /^\d+$/.test(compact)) {
    return +compact.slice(0, degLen) + +compact.slice(degLen, degLen + 2) / 60 + +compact.slice(degLen + 2, degLen + 4) / 3600;
  }
  const p = raw.split(/[°′″'":\s]+/).filter(Boolean);
  const d = +p[0] || 0, mm = +p[1] || 0, ss = +p[2] || 0;
  return d + mm / 60 + ss / 3600;
}
function parsePt(str) {
  if (!str) return null;
  const s = String(str).replace(/\s+/g, ' ').trim();
  const m = s.match(/N\s*([\d°′″'":. ]+?)\s*E\s*([\d°′″'":. ]+)/);
  if (!m) return null;
  const lat = toDeg(m[1], 2), lon = toDeg(m[2], 3);
  if (!(lat >= 0 && lat <= 60 && lon >= 60 && lon <= 150)) return null;
  return [lat, lon];
}
function polyFromText(text) {
  if (!text) return [];
  const tokens = String(text).match(/N[\d°′″'":. ]{3,22}?E[\d°′″'":. ]{3,22}/g) || [];
  return tokens.map(parsePt).filter(Boolean);
}
function polyOf(list) {
  if (!Array.isArray(list)) return [];
  return list.map((p) => parsePt(p && p.value)).filter(Boolean);
}
function clean(s) {
  return String(s == null ? '' : s).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}
// "5 100 m\r\n————————\r\nGND" -> "5100 m–GND"
function vertical(o) {
  let t = clean(o && o.noteVerticalLimit);
  if (!t) return '';
  t = t.replace(/N[\d°′″'":. ]{3,22}?E[\d°′″'":. ]{3,22}/g, ' ')
       .replace(/(?:\s*[—–-]\s*){2,}/g, '–')
       .replace(/\s+/g, ' ')
       .replace(/–\s+/g, '– ')
       .trim();
  return t;
}
function freqNum(v) {
  const m = String(v == null ? '' : v).match(/(\d{3}\.\d{1,3})/);
  return m ? m[1] : null;
}
function chan(list) {
  return (list || []).map((r) => ({
    rank: r.rank === 'ALTERNATE' ? 'ALTERNATE' : 'PRIMARY',
    f: freqNum(r.frequency),
    open: clean(r.openTime || r.noteOpenTime) || '',
    mode: clean(r.modeType) || 'VHF',
    note: clean(r.note) || '',
  })).filter((x) => x.f);
}

// ---------------- 读树 / 机场名 ----------------
const tree = JSON.parse(fs.readFileSync(path.join(SRC, 'AIP.JSON'), 'utf8'));
const roots = tree.filter((n) => {
  const s = n.name || '';
  if (!/^[A-Z]{4}-/.test(s) || /:/.test(s)) return false;
  return !/^[A-Z]{4}-[0-9A-Z]{1,2}-/.test(s);
});
const byId = new Map(tree.map((n) => [n.id, n]));

// ---------------- 机场 ----------------
function readAd(icao) {
  const f = path.join(SRC, 'ad', icao + '.js');
  if (!fs.existsSync(f)) return null;
  const t = fs.readFileSync(f, 'utf8');
  const i = t.indexOf('{'), j = t.lastIndexOf('}');
  try { return JSON.parse(t.slice(i, j + 1)); } catch (e) { console.error('parse fail', icao, e.message); return null; }
}

const airports = [];
const apAreas = [];   // 进近区（含扇区）
const ctrs = [];      // 塔台管制区等

for (const r of roots) {
  const icao = (r.name || '').slice(0, 4);
  const d = readAd(icao);
  if (!d) continue;
  const a1 = d.AD_2_1 || {}, a2 = d.AD_2_2 || {};
  const arp = parsePt(a2.coordinate);
  if (!arp) { console.log('skip no arp', icao); continue; }

  const comms = ((d.AD_2_18 || {}).list || []).map((o) => ({
    type: clean(o.designation) || 'COM',
    cn: clean(o.callSignCn) || clean(o.name) || '',
    en: clean(o.callSignEn) || '',
    f: freqNum(o.frequencyPrimary),
    alt: freqNum(o.frequencyAlternate),
    time: clean(o.workTime) || '',
    note: clean(o.note) || '',
  })).filter((x) => x.f);

  const navs = ((d.AD_2_19 || {}).list || []).map((o) => ({
    id: clean(o.designator),
    type: clean(o.type),
    f: freqNum(o.frequency),
    lat: clean(o.latitude),
    lon: clean(o.longitude),
    loc: clean(o.location),
    cn: clean(o.nameCn),
    rwy: clean(o.runwayDesignator || o.runwayDirectionDesignator),
    note: clean(o.note),
    time: clean(o.workTime),
  })).filter((x) => x.f);

  const runways = (((d.AD_2_12 || {}).runwayDirectionCharacter || {}).list || []).map((x) => ({
    d: clean(x.designator),
    dim: clean(x.nominalLenWid),
    hdg: parseFloat(x.magneticBearing) || null,
    thr: clean(x.elevation),
  }));

  for (const o of ((d.AD_2_17 || {}).list || [])) {
    const pts = polyFromText(o.noteLateralLimit || '');
    if (pts.length < 3) continue;
    ctrs.push({
      icao,
      nameCn: clean(o.designation) || '塔台管制区',
      nameEn: clean(o.designation),
      vertical: vertical(o),
      pts,
    });
  }

  airports.push({
    id: icao,
    iata: clean(a1.designatorIata),
    nameCn: clean(a1.nameCn) || clean(r.name_cn).replace(/^[A-Z]{4}-/, ''),
    nameEn: clean(a1.nameEn) || clean(r.name).replace(/^[A-Z]{4}-/, ''),
    arp,
    arpText: clean(a2.coordinate),
    elev: clean(a2.fieldElevation),
    magvar: clean(a2.magneticVariation),
    comms, navs, runways,
  });
}
airports.sort((a, b) => a.id.localeCompare(b.id));

// ---------------- 进近区（APPAREA） ----------------
function walk(v, fn) {
  if (!v || typeof v !== 'object') return;
  if (Array.isArray(v)) { v.forEach((x) => walk(x, fn)); return; }
  fn(v);
  for (const k in v) if (v[k] && typeof v[k] === 'object') walk(v[k], fn);
}
const app = JSON.parse(fs.readFileSync(path.join(SRC, 'apparea.json'), 'utf8'));
walk(app, (o) => {
  if (!o.nameCn || !o.lateralLimit) return;
  const pts = polyOf(o.lateralLimit.list);
  if (pts.length < 3) return;
  const sv = o.serviceVO || {};
  const freqs = chan(sv.radioChannel && sv.radioChannel.list);
  const loc = clean(o.locationIndicator);
  const icao = (loc.match(/^[A-Z]{4}/) || [null])[0];
  apAreas.push({
    icao,
    loc,
    nameCn: clean(o.nameCn),
    nameEn: clean(o.nameEn),
    call: clean(sv.callSignCn),
    unit: clean(sv.unitProvidingCn),
    vertical: vertical(o),
    freqs,
    pts,
    // 父级“XX进近”没有频率，子级 APxx 才有
    sub: /^AP/i.test(clean(o.nameCn)) || /AP\d/.test(loc),
  });
});

// ---------------- 区调扇区（CTAAREA） ----------------
const cta = JSON.parse(fs.readFileSync(path.join(SRC, 'ctaarea.json'), 'utf8'));
const sectors = [];
walk(cta, (o) => {
  const sv = o.serviceVO || {};
  if (!o.locationIndicator || !sv.callSignCn) return;
  const pts = polyOf((o.lateralLimit && o.lateralLimit.list) || []);
  if (pts.length < 3) return;
  const freqs = chan(sv.radioChannel && sv.radioChannel.list);
  if (!freqs.length) return;
  sectors.push({
    loc: clean(o.locationIndicator),
    nameCn: clean(o.nameCn),
    nameEn: clean(o.nameEn),
    call: clean(sv.callSignCn),
    unit: clean(sv.unitProvidingCn),
    vertical: vertical(o),
    freqs,
    pts,
  });
});
sectors.sort((a, b) => a.nameEn.localeCompare(b.nameEn, 'en', { numeric: true }));

// 把进近区挂到机场
const apByIcao = {};
for (const a of apAreas) if (a.icao) (apByIcao[a.icao] = apByIcao[a.icao] || []).push(a);

// ---------------- 输出 ----------------
const out = {
  meta: { cycle: CYCLE, effective: EFFECTIVE, nextEffective: NEXT_EFFECTIVE, national: true, airports: airports.length, sectors: sectors.length, areas: apAreas.length },
  site: { id: 'CN', nameCn: '全国', nameEn: 'CHINA' },
  cycle: CYCLE,
  effective: EFFECTIVE,
  nextEffective: NEXT_EFFECTIVE,
  arp: [35.0, 104.0],
  airports,
  areas: apAreas,
  sectors,
  ctr: ctrs,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
const nComms = airports.reduce((s, a) => s + a.comms.length, 0);
const nNavs = airports.reduce((s, a) => s + a.navs.length, 0);
const apWith = apAreas.filter((a) => a.freqs.length).length;
console.log(`airports ${airports.length} | comms ${nComms} | navs ${nNavs} | approach areas ${apAreas.length} (${apWith} 带频率) | sectors ${sectors.length} | ctr ${ctrs.length} | ${kb} KB`);
console.log('sectors callsigns:', [...new Set(sectors.map((s) => s.call))].length, '| units', [...new Set(sectors.map((s) => s.unit))].length);
