'use strict';
/**
 * 静态生成机场道面示意图（SVG），用于自检 / 给用户肉眼验收
 * 尽量复用 src/index.html 里的真实绘制代码（按函数名切片后 eval）
 * 用法：node build/gen-diagrams.js [ICAO ...]
 * 输出：$HOME/道面自检.html
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
const CN = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/CN.json'), 'utf8'));
const RWY = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/RWY.json'), 'utf8'));
const GROUND = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/GROUND.json'), 'utf8'));

// ---------- 从源码里切函数 ----------
function funcSrc(name) {
  const start = SRC.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('function not found: ' + name);
  let i = SRC.indexOf('{', start), depth = 0;
  for (; i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}') { depth--; if (!depth) return SRC.slice(start, i + 1); }
  }
  throw new Error('unbalanced: ' + name);
}
const sandbox = { Math, Number, String, Array, Object, JSON, console, isNaN, parseInt, parseFloat };
sandbox.window = {};
vm.createContext(sandbox);
const prelude = `
let zoom = 1;
const proj = {};
const RWY_DATA = ${JSON.stringify(RWY)};
const GROUND_DATA = ${JSON.stringify(GROUND)};
const nf = v => v.toFixed(zoom >= 300 ? 5 : zoom >= 50 ? 4 : zoom >= 10 ? 3 : zoom >= 2 ? 2 : 1);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
${['pt', 'recipRwy', 'aipRunways', 'textW', 'runwaysOf', 'airportDiagram'].map(funcSrc).join('\n')}
function angDiff(a, b){ let d = Math.abs(a-b) % Math.PI; return Math.min(d, Math.PI-d); }
this.API = { pt, runwaysOf, airportDiagram, recipRwy, aipRunways, PROJ: proj, setZoom(z){ zoom = z; }, setView(tx,ty){ proj.tx = tx; proj.ty = ty; } };
`;
vm.runInContext(prelude, sandbox);
const API = sandbox.API;

// ---------- 全国投影（与 App 一致：等距圆柱，纬度余弦） ----------
const W = 760, H = 700;
const pts = [];
CN.airports.forEach(a => pts.push(a.arp));
(CN.border || []).forEach(r => pts.push(...r));
let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
for (const p of pts) { minLat = Math.min(minLat, p[0]); maxLat = Math.max(maxLat, p[0]); minLon = Math.min(minLon, p[1]); maxLon = Math.max(maxLon, p[1]); }
const lat0 = (minLat + maxLat) / 2, lon0 = (minLon + maxLon) / 2;
const cos = Math.cos(lat0 * Math.PI / 180);
const sx = Math.max((maxLon - minLon) * cos, .2), sy = Math.max(maxLat - minLat, .2);
const scale = Math.min(W / (sx * 1.16), H / (sy * 1.16));
const PROJ = API.PROJ; Object.assign(PROJ, { lat0, lon0, cos, scale, w: W, h: H, ox: W / 2, oy: H / 2, tx: 0, ty: 0 });

// ---------- 单场出图 ----------
function diagram(a) {
  const g = GROUND.ap[a.id];
  // 先用 pt 求机场道面 bbox（世界坐标）
  const list = API.runwaysOf(a, g);
  if (!list.length) return null;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const r of list) for (const p of [r.le, r.he]) {
    const [x, y] = API.pt(p);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const bw = Math.max(x1 - x0, 1e-6), bh = Math.max(y1 - y0, 1e-6);
  const z = Math.max(4, Math.min(900, Math.min(W * .66 / bw, H * .62 / bh)));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const tx = W / 2 - z * cx - PROJ.ox * (1 - z);
  const ty = H / 2 - z * cy - PROJ.oy * (1 - z);
  API.setZoom(z);
  PROJ.tx = tx; PROJ.ty = ty;
  const wx = s => PROJ.ox + (s - PROJ.ox - tx) / z;
  const wy = s => PROJ.oy + (s - PROJ.oy - ty) / z;
  const vb = { x0: wx(0), x1: wx(W), y0: wy(0), y1: wy(H) };
  const k = PROJ.scale / 111320;
  const body = API.airportDiagram(a, g, z, k, vb);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">
<rect width="${W}" height="${H}" fill="#0b1016"/>
<g transform="translate(${(PROJ.ox * (1 - z) + tx).toFixed(3)},${(PROJ.oy * (1 - z) + ty).toFixed(3)}) scale(${z})">${body}</g>
</svg>`;
}

const want = process.argv.slice(2).filter(s => /^[A-Z]{4}$/.test(s));
const list = want.length ? CN.airports.filter(a => want.includes(a.id)) : CN.airports;
const cards = [];
let skipped = [];
for (const a of list) {
  const svg = diagram(a);
  if (!svg) { skipped.push(a.id); continue; }
  const rw = (a.runways || []).map(r => r.d + (r.ils ? `·${r.ils.locF}` : '')).join(' ');
  cards.push(`<figure><figcaption><b>${a.id}</b> ${a.nameCn || ''} <span>${rw}</span></figcaption>${svg}</figure>`);
}
const html = `<!doctype html><meta charset="utf-8"><title>道面自检 · SKYWAVE</title>
<style>
body{margin:0;background:#070b10;color:#dfe8f2;font:13px/1.4 -apple-system,"Noto Sans SC",system-ui,sans-serif}
header{position:sticky;top:0;background:#0b1016;border-bottom:1px solid #223040;padding:10px 12px;z-index:2}
h1{font-size:16px;margin:0 0 4px}small{color:#8ba0b8}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px;padding:10px}
figure{margin:0;background:#0d141c;border:1px solid #1d2a38;border-radius:10px;overflow:hidden}
figcaption{padding:6px 8px;font-size:12px;color:#a8bccd;border-bottom:1px solid #16222e}
figcaption b{color:#44d0c0}
figcaption span{color:#ffd479;float:right;font-variant-numeric:tabular-nums}
svg{display:block}
</style>
<header><h1>道面自检 · ${cards.length} 个机场</h1><small>跑道铺面 / 入口条纹 / 中线 / 瞄准点 / 接地区 / 跑道号 / ILS(CAT+频率) / 塔台按跑道分频${skipped.length ? ' · 跳过 ' + skipped.join(' ') : ''}</small></header>
<div class="grid">${cards.join('\n')}</div>`;
fs.writeFileSync(path.join(process.env.HOME, '道面自检.html'), html);
console.log('cards', cards.length, 'skipped', skipped.join(' ') || '-', '->', path.join(process.env.HOME, '道面自检.html'));
