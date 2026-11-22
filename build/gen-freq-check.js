'use strict';
/**
 * 频率标注自检：用 vm 沙箱 eval src/index.html 里的真实函数，按真实投影渲染若干快照，
 * 统计「画出来 / 被丢弃」的标注，并输出 SVG（可转 PNG 肉眼验收）。
 * 用法：node build/gen-freq-check.js
 * 输出：$HOME/频率标注自检.html + build/.freq-check/*.svg
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(process.env.SRC_FILE || path.join(ROOT, 'src/index.html'), 'utf8');
const CN = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/CN.json'), 'utf8'));

function funcSrc(name) {
  const start = SRC.indexOf('function ' + name + '(');
  if (start < 0) return '';   // 允许用旧版源码跑基线对比
  let i = SRC.indexOf('{', start), depth = 0;
  for (; i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}') { depth--; if (!depth) return SRC.slice(start, i + 1); }
  }
  throw new Error('unbalanced: ' + name);
}

const FNS = ['makeProjection', 'nationalBounds', 'clampView', 'viewBounds', 'pt',
  'centroid', 'inPoly', 'vfmt', 'pf', 'textW', 'grid', 'placeLabels', 'render',
  'callShort', 'vband', 'freqParts', 'ctrKind', 'segDist', 'anchorsInPoly', 'sectorShort', 'subCfg', 'nameJoin', 'geomKey', 'vtop', 'mkLabelVariants'];

const W = 400, H = 700;
const svgShim = {
  clientWidth: W, clientHeight: H, innerHTML: '',
  getBoundingClientRect: () => ({ width: W, height: H, left: 0, top: 0 }),
  setAttribute() {}
};
const documentShim = { getElementById: id => (id === 'svg' ? svgShim : null) };

const sandbox = {
  console, Math, Number, String, Array, Object, JSON, Set, Map, WeakMap, isNaN, parseInt, parseFloat,
  document: documentShim,
  window: {},
  D: CN,
  focus: null,
  layerOn: { acc: true, tma: true, twr: true, apt: true },
  DIAG_PPM: 0.03,
  groundLayer: () => '',
  updateBoard: () => {},
  applyView: () => {},
  bindPicks: () => {}
};
vm.createContext(sandbox);

const prelude = `
let proj = {lat0:35,lon0:104,cos:1,scale:1,w:${W},h:${H},ox:${W / 2},oy:${H / 2},tx:0,ty:0,ext:null};
let zoom = 1, lastRenderZoom = 1;
const nf = v => v.toFixed(zoom >= 300 ? 5 : zoom >= 50 ? 4 : zoom >= 10 ? 3 : zoom >= 2 ? 2 : 1);
const sz = v => v.toFixed(6);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const path = pts => pts.map((p, i) => { const [x, y] = pt(p); return (i ? 'L' : 'M') + nf(x) + ' ' + nf(y); }).join(' ') + ' Z';
const linePath = pts => pts.map((p, i) => { const [x, y] = pt(p); return (i ? 'L' : 'M') + nf(x) + ' ' + nf(y); }).join(' ');
const ANCH_CACHE = new WeakMap();
const ringsOf = o => o.rings || [o.pts];
const pathAll = o => ringsOf(o).map(r => path(r)).join(' ');
${FNS.map(funcSrc).join('\n')}
this.API = {
  pt, render,
  get proj(){ return proj; },
  setZoom(z){ zoom = z; },
  setView(tx, ty){ proj.tx = tx; proj.ty = ty; },
  get stats(){ return window.__labelStats; }
};
`;
vm.runInContext(prelude, sandbox);
const API = sandbox.API;

const SHOTS = [
  { name: '全国', lat: 35.0, lon: 104.0, z: 1.0 },
  { name: '全国 z=2（区调扇区）', lat: 35.0, lon: 104.0, z: 2.0 },
  { name: '华北 z=3（区调叠层）', lat: 39.6, lon: 116.4, z: 3.0 },
  { name: '北京终端区 z=20', lat: 40.0, lon: 116.5, z: 20 },
  { name: '北京进近细部 z=45', lat: 39.9, lon: 116.6, z: 45 },
  { name: '上海终端区 z=22', lat: 31.2, lon: 121.5, z: 22 },
  { name: '珠三角 z=20', lat: 23.1, lon: 113.5, z: 20 },
  { name: '成渝 z=20', lat: 30.3, lon: 105.4, z: 20 },
  { name: '东北 z=4', lat: 42.4, lon: 124.0, z: 4 },
  { name: '乌鲁木齐 z=8', lat: 43.9, lon: 87.5, z: 8 }
];

function snap(s) {
  API.render(false);                     // 回到全国基准投影、zoom=1
  const P0 = API.proj;
  const [cx, cy] = API.pt([s.lat, s.lon]);
  const tx = W / 2 - s.z * cx - P0.ox * (1 - s.z);
  const ty = H / 2 - s.z * cy - P0.oy * (1 - s.z);
  API.setZoom(s.z);
  API.setView(tx, ty);
  API.render(true);
  const P = API.proj;
  const body = svgShim.innerHTML;
  const tf = `translate(${(P.ox * (1 - s.z) + P.tx).toFixed(3)},${(P.oy * (1 - s.z) + P.ty).toFixed(3)}) scale(${s.z})`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<rect width="${W}" height="${H}" fill="#070b10"/>` +
    `<g transform="${tf}">${body}</g></svg>`;
  return { body, svg, stats: API.stats || { drawn: 0, dropped: 0, total: 0 } };
}

// ---------- 覆盖率：视窗内带频率的空域对象，其主用频率是否出现在画面里 ----------
function texts(body) {
  const out = [];
  const re = /<text class="([^"]*)"[^>]*>([^<]*)<\/text>/g;
  let m;
  while ((m = re.exec(body))) out.push({ cls: m[1], text: m[2] });
  return out;
}
function inView(lat, lon, P, z) {
  const [x, y] = API.pt([lat, lon]);
  const sx = P.ox * (1 - z) + P.tx + z * x, sy = P.oy * (1 - z) + P.ty + z * y;
  return sx > 0 && sx < W && sy > 0 && sy < H;
}
function coverage(z) {
  const P = API.proj;
  const t = texts(svgShim.innerHTML);
  const ftext = t.filter(x => x.cls === 'freqlbl').map(x => x.text);
  const shown = new Set(ftext.join(' ').split(/[^\d.]+/).filter(Boolean));
  const miss = [];
  let want = 0, got = 0;
  const check = (o, tag) => {
    const pf = (o.freqs || []).filter(f => f && f.f && f.rank !== 'ALTERNATE').map(f => f.f);
    if (!pf.length) return;
    const c = o.pts ? centerOf(o.pts) : null;
    if (!c || !inView(c[0], c[1], P, z)) return;
    want++;
    if (pf.every(f => shown.has(f))) got++;
    else miss.push({ tag, name: nameOf(o), f: pf.join('/'), need: pf.filter(f => !shown.has(f)) });
  };
  CN.sectors.forEach(s => check(s, '区调'));
  CN.areas.forEach(a => check(a, '进近'));
  CN.ctr.forEach(c => {
    const ap = CN.airports.find(x => x.id === c.icao);
    if (!ap || !/twr|tower|control zone/i.test((c.nameEn || '') + (c.nameCn || ''))) return;
    const fs = (ap.twr || []).map(t => t.f);
    if (!fs.length) return;
    const cc = c.pts ? centerOf(c.pts) : null;
    if (!cc || !inView(cc[0], cc[1], P, z)) return;
    want++;
    if (fs.every(f => shown.has(f))) got++;
    else miss.push({ tag: '塔台', name: ap.nameCn + '塔台', f: fs.join('/'), need: fs.filter(f => !shown.has(f)) });
  });
  return { want, got, miss };
}
function centerOf(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[i], p1 = pts[(i + 1) % pts.length];
    const f = p1[1] * p0[0] - p0[1] * p1[0];
    a += f; cx += (p0[1] + p1[1]) * f; cy += (p0[0] + p1[0]) * f;
  }
  a *= 3;
  if (Math.abs(a) < 1e-12) return [pts[0][0], pts[0][1]];
  return [cy / a, cx / a];
}
function nameOf(o) { return o.nameCn || o.nameEn || o.loc || o.icao || ''; }

// ---------- 出图 ----------
fs.mkdirSync(path.join(__dirname, '.freq-check'), { recursive: true });
const rows = [];
let totalDrawn = 0, totalDropped = 0;
for (const s of SHOTS) {
  const r = snap(s);
  const svgFile = path.join(__dirname, '.freq-check', `${s.z.toFixed(2)}-${s.lat.toFixed(1)}_${s.lon.toFixed(1)}.svg`);
  fs.writeFileSync(svgFile, r.svg);
  const cov = coverage(s.z);
  totalDrawn += r.stats.drawn; totalDropped += r.stats.dropped;
  const fr = texts(r.body).filter(x => x.cls === 'freqlbl').length;
  rows.push({ ...s, svgFile, stats: r.stats, fr, cov, svg: r.svg });
}
const html = `<!doctype html><meta charset="utf-8"><title>频率标注自检 · SKYWAVE</title>
<style>
body{margin:0;background:#060a0f;color:#dfe8f2;font:13px/1.5 -apple-system,"Noto Sans SC",system-ui,sans-serif}
header{position:sticky;top:0;z-index:2;background:#0b1118;border-bottom:1px solid #1d2a38;padding:10px 14px}
h1{font-size:16px;margin:0 0 4px}small{color:#8ba0b8}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{border-bottom:1px solid #14202b;padding:5px 8px;text-align:left;vertical-align:top}
th{color:#9fb6c9;font-weight:600;background:#0b1118;position:sticky;top:56px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px;padding:12px}
figure{margin:0;background:#0b1118;border:1px solid #1a2836;border-radius:10px;overflow:hidden}
figcaption{padding:6px 9px;font-size:12px;color:#a8bccd;border-bottom:1px solid #16222e}
figcaption b{color:#7fe3ff}
figcaption em{color:#ffd479;font-style:normal;float:right}
.ok{color:#4ade80}.bad{color:#fb7185}
.miss{color:#f0b0a0;font-size:11px;line-height:1.5}
svg{display:block;width:100%;height:auto;background:#070b10}
</style>
<header><h1>频率标注自检 · ${SHOTS.length} 张快照</h1>
<small>画布 ${W}×${H} · 标注合计 画出 ${totalDrawn} / 丢弃 ${totalDropped} · 绿色=视窗内主用频率全部可读</small></header>
<div class="g">${rows.map(r => `<figure><figcaption><b>${r.name}</b> z=${r.z} <em>标注 ${r.stats.drawn}/${r.stats.total} · 频率行 ${r.fr} · 覆盖 ${r.cov.got}/${r.cov.want}</em></figcaption>${r.svg}</figure>`).join('\n')}</div>
<table><thead><tr><th>快照</th><th>z</th><th>标注画出/丢弃</th><th>视窗内带频率对象</th><th>主用频率全部可读</th><th>分层 画出/候选 · 丢弃</th></tr></thead><tbody>
${rows.map(r => `<tr><td>${r.name}</td><td>${r.z}</td><td>${r.stats.drawn} / ${r.stats.dropped}</td><td>${r.cov.want}</td>
<td class="${r.cov.got === r.cov.want ? 'ok' : 'bad'}">${r.cov.got}</td>
<td class="miss">${(() => { const k = r.stats.byKind || {}; return Object.entries(k).map(([a, b]) => `${a} ${b.drawn}/${b.drawn + b.dropped}`).join(' · ') + ((r.stats.lost || []).length ? '<br>丢弃：' + r.stats.lost.slice(0, 5).join('、') : ''); })()}</td></tr>`).join('\n')}
</tbody></table>`;
const out = process.env.OUT_FILE || path.join(process.env.HOME, '频率标注自检.html');
fs.writeFileSync(out, html);
console.log('shots', rows.length, 'drawn', totalDrawn, 'dropped', totalDropped, '->', out);
for (const r of rows) {
  const bk = Object.entries(r.stats.byKind || {}).map(([a, b]) => `${a}:${b.drawn}/${b.drawn + b.dropped}`).join(' ');
  console.log(`${r.name.padEnd(22)} z=${String(r.z).padEnd(4)} 标注 ${r.stats.drawn}/${r.stats.total} 频率行 ${r.fr}  ${bk}${(r.stats.lost || []).length ? '  丢弃:' + r.stats.lost.join('、') : ''}`);
}
