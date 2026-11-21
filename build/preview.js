'use strict';
/**
 * 生成 docs/preview.svg：全国空域示意（扇区 + 进近区 + 机场），用于 README
 * 用法：node build/preview.js
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(root, 'data/CN.json'), 'utf8'));

const W = 1200, H = 860, PAD = 30;
const ptsAll = [];
D.sectors.forEach((s) => ptsAll.push(...s.pts));
D.areas.forEach((a) => ptsAll.push(...a.pts));
D.airports.forEach((a) => ptsAll.push(a.arp));
const lats = ptsAll.map((p) => p[0]), lons = ptsAll.map((p) => p[1]);
const minLat = Math.min(...lats), maxLat = Math.max(...lats);
const minLon = Math.min(...lons), maxLon = Math.max(...lons);
const lat0 = (minLat + maxLat) / 2, lon0 = (minLon + maxLon) / 2;
const cos = Math.cos((lat0 * Math.PI) / 180);
const scale = Math.min((W - PAD * 2) / ((maxLon - minLon) * cos), (H - PAD * 2) / (maxLat - minLat));
const ox = W / 2, oy = H / 2;
const pt = (p) => [ox + (p[1] - lon0) * cos * scale, oy - (p[0] - lat0) * scale];
const polyPath = (pts) => pts.map((p, i) => { const [x, y] = pt(p); return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }).join(' ') + ' Z';

let g = '';
for (const s of D.sectors) g += `<path d="${polyPath(s.pts)}" fill="#a78bfa" fill-opacity=".07" stroke="#6d5fae" stroke-opacity=".55" stroke-width=".7"/>`;
for (const a of D.areas) g += `<path d="${polyPath(a.pts)}" fill="#39d0ff" fill-opacity="${a.sub ? 0.04 : 0.07}" stroke="#39d0ff" stroke-opacity="${a.sub ? 0.35 : 0.7}" stroke-width="${a.sub ? 0.6 : 1}" ${a.sub ? 'stroke-dasharray="3 5"' : 'stroke-dasharray="7 4"'}/>`;
for (const a of D.airports) {
  const [x, y] = pt(a.arp);
  g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${a.iata ? 3.6 : 2.6}" fill="#ffd27f" stroke="#3a2a10" stroke-width=".8"/>`;
}
// 简单避让：标签过近就跳过
const placed = [];
for (const a of D.airports.filter((x) => x.iata)) {
  const [x, y] = pt(a.arp);
  if (placed.some(([px, py]) => Math.abs(px - x) < 52 && Math.abs(py - y) < 13)) continue;
  placed.push([x, y]);
  g += `<text x="${(x + 6).toFixed(1)}" y="${(y + 3.4).toFixed(1)}" font-size="11" fill="#ffe0a3" font-weight="600">${a.id}</text>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><radialGradient id="bg" cx="50%" cy="0" r="90%"><stop offset="0" stop-color="#0e1720"/><stop offset="1" stop-color="#080d12"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="#080d12"/>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<g font-family="-apple-system,'Noto Sans SC','PingFang SC',system-ui,sans-serif">
${g}
<text x="28" y="44" font-size="26" font-weight="700" fill="#e8eef5" letter-spacing="1">天际电波 SKYWAVE</text>
<text x="28" y="70" font-size="13" fill="#8ba0b5">全国空管频率 · ${D.airports.length} 个机场 · ${D.sectors.length} 个区调扇区 · ${D.areas.filter((a) => a.freqs.length).length} 个进近扇区 · ${D.cycle}</text>
<g transform="translate(28,${H - 64})" font-size="11" fill="#7f95a8">
  <rect x="0" y="-9" width="10" height="10" rx="2" fill="#a78bfa" fill-opacity=".25" stroke="#a78bfa"/><text x="16" y="0">区域管制扇区</text>
  <rect x="120" y="-9" width="10" height="10" rx="2" fill="#39d0ff" fill-opacity=".2" stroke="#39d0ff"/><text x="136" y="0">进近管制区</text>
  <circle cx="245" cy="-4" r="4" fill="#ffd27f"/><text x="256" y="0">国际机场（ICAO）</text>
</g>
</g></svg>`;

fs.writeFileSync(path.join(root, 'docs/preview.svg'), svg);
console.log('preview.svg', (svg.length / 1024).toFixed(0) + ' KB');
