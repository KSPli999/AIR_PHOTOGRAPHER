'use strict';
/**
 * 仓库改名后批量替换链接：node build/rename-repo.js [新仓库名]
 * 默认 SKYWAVE。只改文本链接，不动代码逻辑。
 * 用法（改名完成后）：
 *   node build/rename-repo.js SKYWAVE
 *   git add -A && git commit -m "docs: 仓库改名 SKYWAVE，同步全部链接"
 *   GIT_SSH_COMMAND=$HOME/.ssh/gh443.sh git push origin443 main:main
 */
const fs = require('fs');
const path = require('path');

const OLD = process.env.OLD_REPO || 'AIR_PHOTOGRAPHER';
const NEW = process.argv[2] || 'SKYWAVE';
const ROOT = path.join(__dirname, '..');

const files = [
  'README.md', 'HANDOFF.md', 'LICENSE',
  'docs/推广文案.md', 'docs/data-format.md', 'docs/抓取流程.md',
  'apk/build.sh', 'apk/AndroidManifest.xml'
];

let total = 0;
for (const f of files) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  // 只替换 URL / 标识里的旧仓库名，避免误伤普通文字
  const out = src.split(`/${OLD}`).join(`/${NEW}`)
    .split(`${OLD}.git`).join(`${NEW}.git`)
    .split(`${OLD}`).join(NEW);
  if (out !== src) {
    const n = src.split(OLD).length - 1;
    fs.writeFileSync(p, out);
    total += n;
    console.log(`✔ ${f}: 替换 ${n} 处`);
  }
}

// 同时更新 git remote 的 443 别名
console.log(`\n共替换 ${total} 处 → 新仓库名 ${NEW}`);
console.log(`记得检查：https://github.com/KSPli999/${NEW} 和 https://kspli999.github.io/${NEW}/`);
