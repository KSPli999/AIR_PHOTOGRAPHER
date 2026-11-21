'use strict';
/**
 * eAIP AD 2 -> 全国机场跑道 / ILS / 塔台频率总表
 * 输入：~/work/eaip/ad/*.js （AD_AIP 对象）
 * 输出：
 *   data/AIRPORT_RWY.json     机器可读
 *   全国机场跑道与频率.csv     Excel/表格
 *   全国机场跑道与频率.html    单文件可搜索表格
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = process.argv[2] || path.join(process.env.HOME, 'work/eaip', 'ad');
const ROOT = path.join(__dirname, '..');
const OUT_JSON = path.join(ROOT, 'data', 'AIRPORT_RWY.json');
const OUT_CSV = path.join(process.env.HOME, '全国机场跑道与频率.csv');
const OUT_HTML = path.join(process.env.HOME, '全国机场跑道与频率.html');
const CYCLE = 'EAIP 2026-12 (V1.3)';
const EFFECTIVE = '2026-11-26';

const clean = (s) => (s == null ? '' : String(s).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim());
const num = (s) => {
  const m = String(s == null ? '' : s).match(/-?\d+(\.\d+)?/);
  return m ? +m[0] : null;
};
const listOf = (v) => (v && Array.isArray(v.list) ? v.list : []);

function loadAd(file) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { timeout: 20000 });
  return ctx.AD_AIP;
}

/* ---------------- ILS ---------------- */
function ilsOf(navs) {
  // 按 collocationGroup 归组（LOC/GP/DME 同组）；没有分组时用 runwayDirectionDesignator
  const byKey = new Map();
  for (const n of navs) {
    const name = clean(n.nameCn || n.nameEn);
    const isIlsPart = /^(LOC|GP|DME|ILS)\b/i.test(name) || /ILS/.test(name);
    if (!isIlsPart) continue;
    const end = clean(n.runwayDirectionDesignator);
    const key = clean(n.collocationGroup) || (end ? 'rwy:' + end : '');
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ n, name, end });
  }
  const out = [];
  for (const [, parts] of byKey) {
    const loc = parts.find((p) => /^LOC\b/i.test(p.name) || /^ILS\b/i.test(p.name));
    const gp = parts.find((p) => /^GP\b/i.test(p.name));
    const dme = parts.find((p) => /^DME\b/i.test(p.name));
    const end = clean((loc || parts[0]).end) || clean((loc || parts[0]).n.runwayDirectionDesignator);
    if (!end) continue;
    const catM = (loc && loc.name.match(/CAT\s*(I{1,3}|[123])/i)) || (loc && loc.n.note || '').match(/CAT\s*(I{1,3})/i);
    const cat = catM ? 'CAT ' + catM[1].toUpperCase() : '';
    out.push({
      rwy: end,
      cat,
      loc: loc ? clean(loc.n.designator) : '',
      locF: loc ? num(loc.n.frequency) : null,
      gpF: gp ? num(gp.n.frequency) : null,
      dme: dme ? clean(dme.n.designator) : '',
      note: loc ? clean(loc.n.note) : '',
    });
  }
  return out;
}

/* ---------------- comms ---------------- */
const TYPE_MAP = { TWR: 'TWR', GND: 'GND', DEL: 'DEL', APN: 'APN', RAMP: 'APN', ATIS: 'ATIS', APP: 'APP', AOC: 'AOC', 'OP-CTL': 'OP' };
function commsOf(rows) {
  const out = { TWR: [], GND: [], DEL: [], APN: [], ATIS: [], APP: [] };
  for (const c of rows) {
    const t = TYPE_MAP[clean(c.designation).toUpperCase()] || 'OTHER';
    if (!out[t]) out[t] = [];
    const f = num(c.frequencyPrimary);
    if (f == null) continue;
    const alt = num(c.frequencyAlternate);
    out[t].push({
      f,
      alt: alt != null && alt > 100 ? alt : null,
      call: clean(c.callSignCn) || clean(c.callSignEn),
      time: clean(c.workTime),
      note: clean(c.note),
    });
  }
  return out;
}

/* ---------------- runways ---------------- */
function runwaysOf(ad, ils) {
  const rows = listOf(ad.AD_2_12 && ad.AD_2_12.runwayDirectionCharacter);
  const out = [];
  for (const r of rows) {
    const d = clean(r.designator);
    if (!d) continue;
    const surfaces = listOf(r.runWaySurface).map((s) => clean(s.composition)).filter(Boolean);
    out.push({
      rwy: d,
      mag: num(r.magneticBearing),
      true: num(r.trueBearing),
      dim: clean(r.nominalLenWid),
      surface: surfaces.join('/'),
      pcn: clean((listOf(r.runWaySurface)[0] || {}).pcn),
      elev: clean(r.elevation),
      ils: ils.find((i) => i.rwy === d) || null,
    });
  }
  // 同一跑道两端：按编号排序（13L/31R）
  out.sort((a, b) => a.rwy.localeCompare(b.rwy, 'en', { numeric: true }));
  return out;
}

/* ---------------- main ---------------- */
const files = fs.readdirSync(SRC).filter((f) => /^[A-Z]{4}\.js$/.test(f)).sort();
const airports = [];
for (const f of files) {
  let ad;
  try { ad = loadAd(path.join(SRC, f)); } catch (e) { console.error('skip', f, e.message); continue; }
  if (!ad || !ad.AD_2_1) continue;
  const a1 = ad.AD_2_1, a2 = ad.AD_2_2 || {};
  const icao = clean(a1.locationIndicatorIcao) || f.slice(0, 4);
  const navs = listOf(ad.AD_2_19).map((n) => ({ ...n }));
  const ils = ilsOf(navs);
  const comms = commsOf(listOf(ad.AD_2_18));
  const runways = runwaysOf(ad, ils);
  airports.push({
    id: icao,
    iata: clean(a1.designatorIata),
    nameCn: clean(a1.nameCn),
    nameEn: clean(a1.nameEn),
    arpText: clean(a2.coordinate),
    elev: clean(a2.fieldElevation),
    magvar: clean(a2.magneticVariation),
    runways,
    comms,
    ils,
  });
}
airports.sort((a, b) => a.id.localeCompare(b.id));

const data = {
  meta: { cycle: CYCLE, effective: EFFECTIVE, airports: airports.length, source: 'eAIP China AD 2.12 / 2.18 / 2.19' },
  cycle: CYCLE,
  effective: EFFECTIVE,
  airports,
};
fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(data, null, 1));

/* ---- CSV ---- */
const head = ['ICAO', 'IATA', '机场', '跑道', '磁向', '真向', '长×宽(m)', '道面', 'ILS', 'LOC', 'LOC频率', 'GP频率', 'DME', '塔台', '塔台备', '地面', '放行', '通播', '进近', '塔台呼号', '塔台说明', '标高', '磁差'];
const fsq = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const lines = [head.join(',')];
for (const a of airports) {
  const twrFirst = a.comms.TWR[0] || {};
  const twrF = a.comms.TWR.map((x) => x.f).join(' / ');
  const twrAlt = a.comms.TWR.map((x) => x.alt).filter(Boolean).join(' / ');
  const twrNote = a.comms.TWR.map((x) => [x.f, x.note || x.time].filter(Boolean).join(' ')).join(' / ');
  const gnd = a.comms.GND.map((x) => x.f).join('/');
  const del = a.comms.DEL.map((x) => x.f).join('/');
  const atis = a.comms.ATIS.map((x) => x.f).join('/');
  const app = a.comms.APP.map((x) => x.f).join('/');
  if (!a.runways.length) {
    lines.push([a.id, a.iata, a.nameCn, '', '', '', '', '', '', '', '', '', '', twrF, twrAlt, gnd, del, atis, app, twrFirst.call || '', twrNote, a.elev, a.magvar].map(fsq).join(','));
    continue;
  }
  for (const r of a.runways) {
    const i = r.ils || {};
    lines.push([
      a.id, a.iata, a.nameCn, r.rwy,
      r.mag == null ? '' : r.mag, r.true == null ? '' : r.true,
      r.dim, r.surface,
      i.cat || '', i.loc || '', i.locF || '', i.gpF || '', i.dme || '',
      twrF, twrAlt, gnd, del, atis, app, twrFirst.call || '', twrNote,
      a.elev, a.magvar,
    ].map(fsq).join(','));
  }
}
fs.writeFileSync(OUT_CSV, '\ufeff' + lines.join('\r\n') + '\r\n');

/* ---- HTML ---- */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rowsHtml = airports.map((a) => {
  const twrList = a.comms.TWR;
  const twrCell = twrList.length
    ? twrList.map((x) => `<span class="freq">${esc(x.f)}</span>${x.alt ? `<span class="dim">/${esc(x.alt)}</span>` : ''}${x.note ? `<span class="note">${esc(x.note)}</span>` : (x.time && x.time !== 'H24' ? `<span class="note">${esc(x.time)}</span>` : '')}`).join('<br>')
    : '';
  const gnd = a.comms.GND.map((x) => x.f).join(' / ');
  const del = a.comms.DEL.map((x) => x.f).join(' / ');
  const atis = a.comms.ATIS.map((x) => x.f).join(' / ');
  const app = a.comms.APP.slice(0, 4).map((x) => x.f).join(' / ');
  const rws = a.runways.length ? a.runways : [{}];
  return rws.map((r, idx) => {
    const i = r.ils || {};
    return `<tr class="ap" data-k="${esc([a.id, a.iata, a.nameCn, a.nameEn].join(' ').toLowerCase())}">
<td class="icao">${idx === 0 ? esc(a.id) : ''}</td>
<td class="iata">${idx === 0 ? esc(a.iata) : ''}</td>
<td class="name">${idx === 0 ? esc(a.nameCn) : ''}</td>
<td class="rwy">${esc(r.rwy)}</td>
<td class="num">${r.mag == null ? '' : esc(r.mag) + '°'}</td>
<td class="num dim">${r.true == null ? '' : esc(r.true) + '°'}</td>
<td class="dim">${esc(r.dim)}</td>
<td class="dim">${esc(r.surface)}</td>
<td class="ils">${i.locF ? `<b>${esc(i.cat || 'ILS')}</b> <span class="freq">${esc(i.locF)}</span>${i.gpF ? ` <span class="dim">GP ${esc(i.gpF)}</span>` : ''}${i.loc ? ` <span class="dim">${esc(i.loc)}</span>` : ''}` : ''}</td>
<td class="freq">${idx === 0 ? twrCell : ''}</td>
<td class="freq dim">${idx === 0 ? esc(gnd) : ''}</td>
<td class="freq dim">${idx === 0 ? esc(del) : ''}</td>
<td class="freq dim">${idx === 0 ? esc(atis) : ''}</td>
<td class="freq dim">${idx === 0 ? esc(app) : ''}</td>
<td class="dim">${idx === 0 ? esc(twrList[0] ? twrList[0].call : '') : ''}</td>
</tr>`;
  }).join('');
}).join('');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>全国机场跑道 · ILS · 塔台频率</title>
<style>
:root{--bg:#0b1016;--card:#121922;--line:#233041;--fg:#e8eef7;--dim:#8ba0b8;--accent:#44d0c0}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 -apple-system,"Noto Sans SC",system-ui,sans-serif}
header{position:sticky;top:0;z-index:2;background:rgba(11,16,22,.96);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:12px 14px}
h1{margin:0 0 6px;font-size:17px;letter-spacing:.5px}
h1 small{color:var(--dim);font-weight:400;font-size:12px;margin-left:8px}
#q{width:100%;padding:9px 12px;border-radius:9px;border:1px solid var(--line);background:#0e151d;color:var(--fg);font-size:14px;outline:none}
#q:focus{border-color:var(--accent)}
.meta{color:var(--dim);font-size:12px;margin-top:6px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th,td{padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap;text-align:left}
thead th{position:sticky;top:0;background:#0e151d;color:var(--dim);font-weight:500;font-size:12px;z-index:1}
tbody tr:hover{background:#16202b}
td.icao{font-weight:600;color:var(--accent)}
td.rwy{font-weight:600}
td.num,td.dim{color:var(--dim)}
td.freq{color:#ffd479}
span.note{color:#7f93a9;font-size:11px;margin-left:5px}
td.ils .freq{color:#ff9f6e}
h2{font-size:13px;color:var(--dim);font-weight:500;margin:18px 0 6px;padding:0 14px}
.wrap{overflow:auto}
@media(max-width:640px){th,td{padding:5px 6px;font-size:12px}}
</style></head><body>
<header>
<h1>全国机场跑道 · ILS · 塔台频率 <small>${esc(CYCLE)} · ${airports.length} 场</small></h1>
<input id="q" placeholder="搜索：机场名 / ICAO / IATA / 跑道号 / 频率，如 ZBAA、31R、118.25">
<div class="meta">数据源：eAIP China AD 2.12 跑道 / AD 2.19 导航设施 / AD 2.18 通信设施 · 生效 ${esc(EFFECTIVE)} · 磁向单位度，频率单位 MHz</div>
</header>
<div class="wrap"><table id="t">
<thead><tr><th>ICAO</th><th>IATA</th><th>机场</th><th>跑道</th><th>磁向</th><th>真向</th><th>长×宽</th><th>道面</th><th>ILS</th><th>塔台频率（备用/说明）</th><th>地面</th><th>放行</th><th>通播</th><th>进近</th><th>塔台呼号</th></tr></thead>
<tbody>${rowsHtml}</tbody>
</table></div>
<script>
const q=document.getElementById('q'),rows=[...document.querySelectorAll('#t tbody tr')];
q.addEventListener('input',()=>{const v=q.value.trim().toLowerCase();for(const r of rows){r.style.display=!v||r.dataset.k.includes(v)||r.textContent.toLowerCase().includes(v)?'':'none';}});
</script>
</body></html>`;
fs.writeFileSync(OUT_HTML, html);

const nRwy = airports.reduce((s, a) => s + a.runways.length, 0);
const nIls = airports.reduce((s, a) => s + a.ils.length, 0);
const noTwr = airports.filter((a) => !a.comms.TWR.length).length;
console.log(`airports ${airports.length} | runway ends ${nRwy} | ILS ${nIls} | no TWR ${noTwr}`);
console.log('->', OUT_JSON);
console.log('->', OUT_CSV);
console.log('->', OUT_HTML);
