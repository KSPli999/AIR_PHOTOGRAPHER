'use strict';
// 无浏览器环境下的冒烟测试：跑一遍渲染/表格/详情逻辑，检查是否抛错
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', process.argv[2] || 'src/index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*)<\/script>/)[1];

const els = {};
function el(id) {
  if (!els[id]) els[id] = {
    id, innerHTML: '', textContent: '', value: '', dataset: {}, style: {}, className: '',
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    addEventListener(){}, setAttribute(){}, getAttribute(){}, click(){},
    querySelectorAll(){ return []; }, getBoundingClientRect(){ return {width: 400, height: 700}; },
    clientWidth: 400, clientHeight: 700, files: [], onclick: null, onchange: null,
  };
  return els[id];
}
const store = {};
global.document = {
  getElementById: el,
  querySelectorAll(sel) { return []; },
  querySelector() { return null; },
  createElement() { return el('tmp'); },
  body: { appendChild(){}, removeChild(){} },
};
global.window = { innerWidth: 400, innerHeight: 800, addEventListener(){}, };
global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, };
const fakeNavigator = {};
global.fetch = () => Promise.reject(new Error('no net'));
global.FileReader = function(){};
global.alert = m => console.log('ALERT', m);

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data/CN.json'), 'utf8'));
const ctx = { __EMBEDDED_DATA__: data, console, setTimeout, clearTimeout, addEventListener(){}, innerWidth: 400, innerHeight: 800, DSHApp: null };
const fn = new Function('window', 'document', 'localStorage', 'navigator', 'fetch', 'FileReader', 'alert', 'console', 'setTimeout', 'clearTimeout', code + '\n;return { render, buildTable, buildSrc, showAirport, showArea, showSector, showTower, D, PACKS, usePack };');
const api = fn(ctx, global.document, global.localStorage, fakeNavigator, global.fetch, global.FileReader, global.alert, console, setTimeout, clearTimeout);

const svg = els['svg'];
const tbl = els['tblBody'], src = els['listSrc'];
const shBody = () => el('shBody');
console.log('数据:', data.airports.length, '机场 /', data.areas.length, '进近区 /', data.sectors.length, '扇区');
console.log('SVG 长度', svg.innerHTML.length, 'path 数', (svg.innerHTML.match(/<path/g) || []).length, 'circle 数', (svg.innerHTML.match(/<circle/g) || []).length);
console.log('标注 <text> 数', (svg.innerHTML.match(/<text/g) || []).length);

console.log('\n-- 频率总表 --');
console.log('行数', (tbl.innerHTML.match(/class="row"/g) || []).length, '长度', tbl.innerHTML.length);

for (const [name, call] of [['机场 ZBYN', () => api.showAirport(data.airports.findIndex(a => a.id === 'ZBYN'))],
  ['机场 ZBAA', () => api.showAirport(data.airports.findIndex(a => a.id === 'ZBAA'))],
  ['进近', () => api.showArea(data.areas.findIndex(a => a.freqs.length && !a.sub))],
  ['扇区', () => api.showSector(0)],
  ['塔台区', () => api.showTower(0)]]) {
  call();
  const txt = shBody().innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(`\n[${name}] 标题=${el('shTitle').textContent}`);
  console.log('  ', txt.slice(0, 260));
}

// 浦东/虹桥 共用进近检查
api.showAirport(data.airports.findIndex(a => a.id === 'ZSPD'));
console.log('\n[ZSPD] ', shBody().innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 420));

// 缩放 / 聚焦
api.render(true);
svg.innerHTML = svg.innerHTML;
console.log('zoom 重绘后 path', (svg.innerHTML.match(/<path/g) || []).length, 'text', (svg.innerHTML.match(/<text/g) || []).length);
// 坐标范围
const xs = [...svg.innerHTML.matchAll(/M([\d.-]+) ([\d.-]+)/g)].map(m => [+m[1], +m[2]]);
const xmin = Math.min(...xs.map(p => p[0])), xmax = Math.max(...xs.map(p => p[0]));
const ymin = Math.min(...xs.map(p => p[1])), ymax = Math.max(...xs.map(p => p[1]));
console.log('路径坐标范围 x', xmin.toFixed(0), xmax.toFixed(0), 'y', ymin.toFixed(0), ymax.toFixed(0));
// 搜索过滤
el('q').value = '太原';
api.buildTable();
console.log('搜索「太原」行数', (el('tblBody').innerHTML.match(/class="row"/g) || []).length,
  '| 提示', el('qinfo').textContent);
el('q').value = '118.25';
api.buildTable();
console.log('搜索「118.25」行数', (el('tblBody').innerHTML.match(/class="row"/g) || []).length, '| 提示', el('qinfo').textContent);
el('q').value = '';
api.buildTable();
