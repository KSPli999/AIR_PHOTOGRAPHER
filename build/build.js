'use strict';
/**
 * 打包器：把 index.html + data.json 合成一个自包含的 HTML 单文件。
 * 用法： node build.js            -> dist/太原空域频率图.html
 *        node build.js other.json -> 用别的数据包
 */
const fs = require('node:fs');
const path = require('node:path');

const dir = __dirname;
const dataFile = process.argv[2] || 'data.json';
const data = JSON.parse(fs.readFileSync(path.join(dir, dataFile), 'utf8'));
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

const inject = `window.__EMBEDDED_DATA__ = ${JSON.stringify(data)};\n`;
html = html.replace('<script>\nconst P = (lat, lon)', `<script>\n${inject}const P = (lat, lon)`);
if (!html.includes('__EMBEDDED_DATA__')) throw new Error('注入失败：未找到脚本入口');

const outDir = path.join(dir, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const name = dataFile === 'data.json' ? '太原空域频率图.html' : dataFile.replace(/\.json$/, '') + '.html';
fs.writeFileSync(path.join(outDir, name), html, 'utf8');
console.log('built', path.join(outDir, name), (html.length / 1024).toFixed(0) + ' KB');
