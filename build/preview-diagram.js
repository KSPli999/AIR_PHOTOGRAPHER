'use strict';
/**
 * 道面图肉眼验收：把某个机场按真实缩放画出来（含跑道号 / ILS / 塔台字），输出 SVG。
 * 用法：node build/preview-diagram.js ZBHH [zc]
 * 输出：build/.freq-check/<ICAO>-diag.svg（再 rsvg-convert 成 png 看）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
const CN = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/CN.json'), 'utf8'));
const RWY = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/RWY.json'), 'utf8'));
const GROUND = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/GROUND.json'), 'utf8'));
const TERM = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/TERM.json'), 'utf8'));

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

const id = process.argv[2] || 'ZBHH';
const zc = Number(process.argv[3] || 20);
const W = 900, H = 900;

const sandbox = {
  console, Math, Number, String, Array, Object, JSON, Set, Map, WeakMap, isNaN, parseInt, parseFloat,
  D: CN, RWY_DATA: RWY, GROUND_DATA: GROUND, TERM_DATA: TERM,
  layerOn: { acc: true, tma: true, twr: true, apt: true }
};
vm.createContext(sandbox);

const prelude = `
let proj = {lat0:35,lon0:104,cos:1,scale:1,w:${W},h:${H},ox:${W / 2},oy:${H / 2},tx:0,ty:0,ext:null};
let zoom = ${zc};
const nf = v => v.toFixed(3);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function pt(p){ return [(p[1] - proj.lon0) * proj.cos * proj.scale, -(p[0] - proj.lat0) * proj.scale]; }
${funcSrc('recipRwy')}
const angDiff = (a, b) => { let d = Math.abs(a - b) % Math.PI; return Math.min(d, Math.PI - d); };
${funcSrc('aipRunways')}
${funcSrc('runwaysOf')}
${funcSrc('textW')}
${funcSrc('airportDiagram')}
this.API = {
  pt, airportDiagram, runwaysOf,
  get proj(){ return proj; },
  setProj(p){ Object.assign(proj, p); }
};
`;
vm.runInContext(prelude, sandbox);
const API = sandbox.API;

const a = CN.airports.find(x => x.id === id);
if (!a) { console.error('no such airport', id); process.exit(1); }
const g = (GROUND.ap || {})[id];

// 以机场参考点为视窗中心建投影（scale 固定，再由 zc 放大到屏幕）
const lat0 = a.arp[0], lon0 = a.arp[1];
const scale = Number(process.argv[4] || 900);
API.setProj({ lat0, lon0, cos: Math.cos(lat0 * Math.PI / 180), scale, ox: W / 2, oy: H / 2 });
const [cx0, cy0] = API.pt(a.arp);
const body = API.airportDiagram(a, g, zc, API.proj.scale / 111320, null);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
  `<rect width="${W}" height="${H}" fill="#0a0f16"/>` +
  `<g transform="translate(${(W / 2 - zc * cx0).toFixed(3)},${(H / 2 - zc * cy0).toFixed(3)}) scale(${zc})">${body}</g></svg>`;

const outDir = path.join(ROOT, 'build/.freq-check');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, id + '-diag.svg');
fs.writeFileSync(out, svg);
console.log('wrote', out, 'body', body.length, 'runways', API.runwaysOf(a, g).map(r => r.la + '/' + r.lb).join(','));
