'use strict';
/**
 * 生成 data/border.json：中国国界（含海岸线、台湾岛）简化折线。
 * 用途有两个：① 地图底图轮廓；② 补齐 AIP 侧限里的 “National Boundaries”，
 * 免得多边形被直线抄近路切到境外去。
 *
 * 输入：~/chn10.json   Natural Earth 1:10m ADM0=China 的 MultiPolygon 坐标
 *      ~/twn.json     Natural Earth 1:10m ADM0=Taiwan 的环（只作底图）
 * 用法：node build/make-border.js [chn10.json]
 */
const fs = require('node:fs');
const path = require('node:path');

const src = process.argv[2] || path.join(process.env.HOME, 'chn10.json');
const raw = JSON.parse(fs.readFileSync(src, 'utf8')); // [poly][ring][pt][lon,lat]
const twFile = path.join(process.env.HOME, 'twn.json');
const tw = fs.existsSync(twFile) ? JSON.parse(fs.readFileSync(twFile, 'utf8')) : [];

// Douglas-Peucker（经纬度平面，tolerance 单位：度）
function dp(pts, tol) {
  if (pts.length < 3) return pts;
  // 闭合环首尾重复点会让分段长度退化为 0，先去掉
  const a = pts[0], b = pts[pts.length - 1];
  if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) pts = pts.slice(0, -1);
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop();
    const [x0, y0] = pts[i0], [x1, y1] = pts[i1];
    const dx = x1 - x0, dy = y1 - y0;
    const L = Math.hypot(dx, dy) || 1e-12;
    let best = -1, bi = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const [x, y] = pts[i];
      const d = Math.abs(dy * x - dx * y + x1 * y0 - y1 * x0) / L;
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; stack.push([i0, bi], [bi, i1]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function area(ring) {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]);
  return Math.abs(s / 2);
}
const TOL = 0.012;          // ≈ 1.2 km，贴合国界又不臃肿
const MIN_AREA = 0.02;      // 平方度，滤掉小礁石
const out = [];
for (const poly of [...raw, ...tw.map((r) => [r])]) {
  for (const ring of poly) {
    if (area(ring) < MIN_AREA) continue;
    const pts = dp(ring, TOL).map(([lon, lat]) => [Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5]);
    if (pts.length >= 4) out.push(pts);
  }
}
out.sort((a, b) => b.length - a.length);
const OUT = path.join(__dirname, '../data/border.json');
fs.writeFileSync(OUT, JSON.stringify(out));
const n = out.reduce((s, r) => s + r.length, 0);
console.log('rings', out.length, 'points', n, 'KB', (fs.statSync(OUT).size / 1024).toFixed(1), 'main ring', out[0].length);
