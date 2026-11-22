'use strict';
/**
 * 打包器：src/index.html + data/CN.json → 单文件 HTML
 * 同步写入 docs/index.html（GitHub Pages）、downloads/天际电波-单文件.html、apk/assets/index.html
 * 用法：node build/build.js [data/CN.json]
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dataFile = path.resolve(root, process.argv[2] || 'data/CN.json');
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
let html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');

let inject = `window.__EMBEDDED_DATA__ = ${JSON.stringify(data)};\n`;
const rwyFile = path.join(root, 'data/RWY.json');
if (fs.existsSync(rwyFile)) inject += `window.__RWY__ = ${fs.readFileSync(rwyFile, 'utf8')};\n`;
const groundFile = path.join(root, 'data/GROUND.json');
if (fs.existsSync(path.join(root, 'data/TERM.json'))) inject += `window.__TERM__ = ${fs.readFileSync(path.join(root, 'data/TERM.json'), 'utf8')};\n`;
if (fs.existsSync(groundFile)) inject += `window.__GROUND__ = ${fs.readFileSync(groundFile, 'utf8')};\n`;
const anchor = '<script>\nconst P = (lat, lon)';
if (!html.includes(anchor)) throw new Error('注入失败：未找到脚本入口');
html = html.replace(anchor, `<script>\n${inject}const P = (lat, lon)`);
if (!html.includes('__EMBEDDED_DATA__')) throw new Error('注入失败');

const targets = [
  path.join(root, 'docs/index.html'),
  path.join(root, 'downloads/天际电波-单文件.html'),
  path.join(root, 'apk/assets/index.html'),
];
for (const t of targets) {
  fs.mkdirSync(path.dirname(t), { recursive: true });
  fs.writeFileSync(t, html, 'utf8');
  console.log('built', path.relative(root, t), (html.length / 1024).toFixed(0) + ' KB');
}
