'use strict';
/** 生成 docs/preview.svg —— 与页面同源的静态预览图（GitHub 可直接渲染 SVG） */
const fs = require('node:fs');
const path = require('node:path');

const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'ZBYN.json'), 'utf8'));
const W = 1200, H = 780;
const PAD = 40;

const all = [...D.tma.pts, ...D.ctr.flatMap(c => c.pts), D.arp, ...D.sectors.filter(s => s.tyn).flatMap(s => s.pts)];
const lat0 = (Math.min(...all.map(p => p[0])) + Math.max(...all.map(p => p[0]))) / 2;
const lon0 = (Math.min(...all.map(p => p[1])) + Math.max(...all.map(p => p[1]))) / 2;
const cos = Math.cos(lat0 * Math.PI / 180);

// 视野：太原进近区 + 一圈余量（也画出周边扇区做背景）
const b = { s: 36.85, n: 38.75, w: 111.4, e: 114.0 };
const scale = Math.min((W - PAD * 2) / ((b.e - b.w) * cos), (H - PAD * 2) / (b.n - b.s));
const ox = W / 2, oy = H / 2;
const pt = p => [
  ox + (p[1] - (b.w + b.e) / 2) * cos * scale,
  oy - (p[0] - (b.s + b.n) / 2) * scale
];
const pathD = pts => pts.map((p, i) => { const [x, y] = pt(p); return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }).join(' ') + ' Z';
const cen = pts => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

let g = '';

// 背景扇区
for (const s of D.sectors) {
  if (!s.pts || s.pts.length < 3) continue;
  g += `<path d="${pathD(s.pts)}" fill="#4b6b86" fill-opacity="0.05" stroke="#33546b" stroke-width="0.8" stroke-opacity="0.55"/>\n`;
}
// 太原扇区
const clampX = v => Math.max(70, Math.min(W - 70, v));
const clampY = v => Math.max(24, Math.min(H - 60, v));
for (const s of D.sectors.filter(x => x.tyn)) {
  const [la, lo] = cen(s.pts);
  let [x, y] = pt([la, lo]);
  x = clampX(x); y = clampY(y);
  g += `<path d="${pathD(s.pts)}" fill="#a78bfa" fill-opacity="0.14" stroke="#a78bfa" stroke-width="1.5"/>\n`;
  g += `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" fill="#d9c9ff" font-size="13" font-weight="700" text-anchor="middle" font-family="sans-serif">${s.nameEn}</text>\n`;
  g += `<text x="${x.toFixed(0)}" y="${(y + 16).toFixed(0)}" fill="#39d0ff" font-size="13" font-weight="700" text-anchor="middle" font-family="sans-serif">${s.freqs[0].f}</text>\n`;
}
// 进近区
g += `<path d="${pathD(D.tma.pts)}" fill="#39d0ff" fill-opacity="0.07" stroke="#39d0ff" stroke-width="2" stroke-dasharray="8 5"/>\n`;
{
  const [la, lo] = cen(D.tma.pts);
  const [x, y] = pt([la, lo]).map((v, i) => i ? clampY(v) : clampX(v));
  g += `<text x="${x.toFixed(0)}" y="${(y - 150).toFixed(0)}" fill="#7fe3ff" font-size="15" font-weight="700" text-anchor="middle" font-family="sans-serif">太原进近 ZBYNAPP  GND–5100 m</text>\n`;
}
// 塔台区
for (const c of D.ctr) {
  const [la, lo] = cen(c.pts);
  const [x, y] = pt([la, lo]).map((v, i) => i ? clampY(v) : clampX(v));
  g += `<path d="${pathD(c.pts)}" fill="#fb7185" fill-opacity="0.12" stroke="#fb7185" stroke-width="1.6"/>\n`;
  g += `<text x="${x.toFixed(0)}" y="${(y + 40).toFixed(0)}" fill="#ffb3c0" font-size="12" text-anchor="middle" font-family="sans-serif">塔台 118.25 · SFC–1500 m</text>\n`;
}
// 跑道（真方位 139°，3600 m，间距 490 m）
{
  const [ax, ay] = pt(D.arp);
  const brg = (133 + 5.9) * Math.PI / 180;
  const px = 3600 * scale / 111320, sep = 490 * scale / 111320;
  for (const off of [-sep / 2, sep / 2 + 1350 * scale / 111320]) {
    const cx = ax + off * Math.cos(brg), cy = ay + off * Math.sin(brg);
    const dx = Math.sin(brg) * px / 2, dy = -Math.cos(brg) * px / 2;
    g += `<line x1="${(cx - dx).toFixed(1)}" y1="${(cy - dy).toFixed(1)}" x2="${(cx + dx).toFixed(1)}" y2="${(cy + dy).toFixed(1)}" stroke="#0b1016" stroke-width="8" stroke-linecap="round"/>\n`;
    g += `<line x1="${(cx - dx).toFixed(1)}" y1="${(cy - dy).toFixed(1)}" x2="${(cx + dx).toFixed(1)}" y2="${(cy + dy).toFixed(1)}" stroke="#e6eef7" stroke-width="4" stroke-linecap="round"/>\n`;
  }
  g += `<circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="3" fill="#fb7185"/>\n`;
  g += `<text x="${(ax + 16).toFixed(0)}" y="${(ay + 5).toFixed(0)}" fill="#e6eef7" font-size="14" font-weight="700" font-family="sans-serif">ZBYN 太原/武宿</text>\n`;
}
// VOR
{
  const v = [37 + 45.2 / 60, 112 + 37.0 / 60], [x, y] = pt(v);
  const R = 0.30 * Math.min(W, H) / 2;
  g += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${R.toFixed(0)}" fill="none" stroke="#39d0ff" stroke-opacity="0.16" stroke-dasharray="3 7"/>\n`;
  g += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(R * 0.66).toFixed(0)}" fill="none" stroke="#39d0ff" stroke-opacity="0.10" stroke-dasharray="3 7"/>\n`;
  g += `<path d="M${(x - 9).toFixed(0)} ${y.toFixed(0)} L${(x + 9).toFixed(0)} ${y.toFixed(0)} M${x.toFixed(0)} ${(y - 9).toFixed(0)} L${x.toFixed(0)} ${(y + 9).toFixed(0)}" stroke="#39d0ff" stroke-width="1.4"/>\n`;
  g += `<text x="${(x + 12).toFixed(0)}" y="${(y - 10).toFixed(0)}" fill="#7fe3ff" font-size="13" font-weight="700" font-family="sans-serif">TYN 113.10</text>\n`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><radialGradient id="bg" cx="50%" cy="0%" r="90%">
  <stop offset="0%" stop-color="#101a24"/><stop offset="70%" stop-color="#080d12"/>
</radialGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
${g}
<g font-family="sans-serif">
  <text x="30" y="46" fill="#e8eef5" font-size="24" font-weight="700">天际电波 SKYWAVE</text>
  <text x="30" y="70" fill="#8ba0b5" font-size="13">太原空域 · 航空无线电频率图 · EAIP 2026-12（2612 期，2026-11-26 生效）</text>
</g>
<g font-family="sans-serif" font-size="11.5" fill="#8ba0b5">
  <text x="${W - 30}" y="${H - 44}" text-anchor="end">—— 太原进近（119.2 / 119.55）</text>
  <text x="${W - 30}" y="${H - 28}" text-anchor="end">—— 塔台管制区（118.25）</text>
  <text x="${W - 30}" y="${H - 12}" text-anchor="end">—— 区调扇区 AR33/34/35（120.55 / 127.1 / 133.9）</text>
</g>
</svg>
`;

fs.mkdirSync(path.join(__dirname, '..', 'docs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'preview.svg'), svg);
console.log('preview.svg', (svg.length / 1024).toFixed(0) + 'KB');
