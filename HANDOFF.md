# 天际电波 SKYWAVE · 工程交接书

> 写于 2026-11-22，最近更新 2026-11-25，对应 APK `2026.12.25.9`（versionCode 31），git `本次改动`。
> 目的：让一个**没有上下文的新对话**读完这一份就能接着干。

---

## 0. 给新对话的开场白（直接复制粘贴）

```
你在继续开发「天际电波 SKYWAVE」安卓拍机 App，工程在 ~/work/airspace，先读 HANDOFF.md 和 README.md。
规矩：只看 eAIP 公开数据；频率只放在塔台/进近/区调所属区块里，机场名标注不带频率；
全国视角只画机场点 + 「中文名 ICAO」，不画缩小的机场图；航站楼只要轮廓不要 T1/T2 不要机位；
一切离线、单文件 HTML + WebView，用 apk/build.sh 在本机构建。
改完必须：node build/build.js → apk/build.sh → 重启预览 3113 并告诉我新 APK 路径。
```

---

## 1. 这是什么

**天际电波（SKYWAVE）** —— 拍机人的航空波段图鉴：把 118–137 MHz 的塔台 / 进近 / 区调频率画到中国空域图上，按下快门前先知道听哪个波道。

- 产物只有安卓：单个 APK，**完全离线**（数据全部内联进 HTML，无网络请求）
- 实现上就是 **一个 HTML 文件（内联 SVG 地图 + 内联 JS）+ WebView 壳**，不引第三方库、不联网、不打包框架
- 数据源：**eAIP China**（航图/频率/空域/跑道号）+ **OpenStreetMap**（道面/航站楼几何，ODbL 许可）

当前数据周期：**EAIP 2026-12 (V1.3)**，2026-11-26 生效，2026-12-24 失效。

---

## 2. 用户已经定死的要求（不要擅自改回去）

这些是几轮迭代里明确拒绝过某些做法的结果，**属于需求，不是实现细节**：

| # | 要求 | 反面（已被否决） |
|---|---|---|
| 1 | 只做 eAIP 里公开的机场（82 个），民航空白机场不管 | 抓全网 258 个机场 |
| 2 | 频率**只出现在塔台区 / 进近区 / 区调扇区对应的多边形区块里** | 频率写进机场标注 |
| 3 | 跑道频率牌是**固定悬浮卡片**（`#aptBoard`，右上角），不跟地图平移 | 跟着地图跑的信息框 |
| 4 | 全国视角**只画机场点 + 「北京 ZBAA」**，任何倍率都常显 | 把机场图缩到 52px 画上去 → 一堆灰碎块，用户骂「何意味」 |
| 5 | 放大后是**完整机场图**（跑道铺面/滑行道/机坪/航站楼），不用「跑道线」当中间态 | 高倍率用线画跑道 |
| 6 | 航站楼**只要轮廓**，不要 T1/T2 文字，不要机位/stands | 航站楼里标 T1/T2 |
| 7 | 界面中文、离线、单文件；APK 必须在本机（aapt/javac/d8/apksigner）构建出来 | 依赖 Android Studio / Gradle 联网 |

---

## 3. 目录与产物

工程根目录：`~/work/airspace`（= `/data/user/0/app.dsh.mobile/files/dsh-home/work/airspace`）
git remote：`git@github.com:KSPli999/AIR_PHOTOGRAPHER.git`，分支 `main`
（本机 git 需加 `-c safe.directory='*'`）

```
work/airspace/
├── src/index.html          61 KB   ★唯一的界面源码（内联 CSS/JS/SVG，~1250 行）
├── data/                          ★数据层（构建时全部内联进 HTML）
│   ├── CN.json             832 KB  机场/频率/进近区/区调扇区/FIR/CTR/边界 —— 主数据
│   ├── AIRPORT_RWY.json    256 KB  跑道编号/朝向/尺寸/道面/PCN/ILS/塔台频率（人读表）
│   ├── GROUND.json         1.8 MB  OSM 道面：跑道/滑行道/机坪/机场边界
│   ├── TERM.json           116 KB  OSM 航站楼轮廓
│   ├── RWY.json             12 KB  68 个机场的跑道端头坐标（道面校准用）
│   └── border.json          80 KB  国界底图
├── build/                  生成与预览脚本（见 §6）
│   └── gen-freq-check.js   频率标注自检：真实投影出快照 SVG + 重叠/丢弃统计
├── apk/                    Android 工程 + build.sh + keystore + 产物
│   ├── AndroidManifest.xml versionCode 27 / versionName 2026.12.25.5
│   ├── src/app/dsh/airspace/MainActivity.java  WebView 壳（assets/index.html）
│   ├── assets/index.html   构建时覆盖
│   └── 空域频率图.apk      740 KB
├── docs/
│   ├── index.html          2.8 MB  GitHub Pages 在线版（build 产物）
│   ├── data-format.md      数据字段说明
│   ├── 抓取流程.md         eAIP 下个周期的抓取 SOP（含跑道总表一节）
│   ├── preview.svg / icon.png / airport-chart*.png
├── downloads/
│   ├── 天际电波.apk        740 KB  ← APK 副本，交付位置
│   └── 天际电波-单文件.html 2.8 MB  双击即开的离线网页
├── README.md               对外说明（数据统计表在这里）
└── HANDOFF.md              本文件
```

另有两份交付到 `$HOME` 的总表（不参与 APK 构建）：
- `~/全国机场跑道与频率.csv`（23 列，254 行，UTF-8 BOM，Excel 直接开）
- `~/全国机场跑道与频率.html`（单文件可搜索，`node build/serve-rwy.js` 预览）
- `~/道面自检.html`（4.3 MB，82 场道面缩略图长廊，`node build/serve-gallery.js` 预览）

---

## 4. 数据层

### 4.1 规模（当前）

| 项 | 数量 |
|---|---|
| 机场 | 82（eAIP 全部公开 AD 2 机场） |
| 机场通信频率 | 748 条（TWR/GND/DEL/APN/ATIS/APP） |
| 进近区 | 326 个（280 个带频率，557 条主备） |
| 区调扇区 | 300 个（606 条主备，24 个单位） |
| FIR 情报区 | 9 个轮廓（仅底图） |
| 导航设施 | 898 个（含 237 条跑道端 ILS 已对上跑道号） |
| ATS 空域（CTR 等） | 46 个 |
| 跑道（道面几何） | 148 条 |
| 滑行道段 | 15057 |
| 机坪 | 552 |
| 航站楼 | 197 栋 / 82 场 |
| 跑道端（总表） | 254 个，其中 237 个有 ILS |

### 4.2 `data/CN.json`（主数据）

顶层：`meta, site, cycle, effective, nextEffective, arp, airports[], areas[], sectors[], fir[], ctr[], border[]`

- `airports[]`：`{id(ICAO), iata, nameCn, nameEn, arp[lat,lon], arpText, elev, magvar, comms[], navs[], runways[], twr[]}`
  - `comms[]`：`{type, cn, en, f, alt, time, note}`，`type` ∈ ATIS/APP/TWR/GND/DEL/APN/ACC…
  - `twr[]`：塔台频率 `{f, alt, time, note, rwys}`（哪几个跑道号用这条）
- `areas[]`：进近区 `{icao, loc, nameCn, nameEn, call, unit, vertical, pts[]}`
- `sectors[]`：区调扇区 `{loc, nameCn, nameEn, call, unit, vertical, freqs[], pts[]}`
- 字段细节见 `docs/data-format.md`

### 4.3 `data/AIRPORT_RWY.json`（跑道 / ILS / 塔台频率总表）

```
{ meta:{cycle,effective,airports,source}, airports:[
  { id:"ZBAA", iata:"PEK", nameCn, nameEn, arpText, elev, magvar,
    runways:[ { rwy:"01", mag:1, true:352.98, dim:"3800×60", surface:"CONC",
                pcn:"PCR 930/R/A/W/T", elev:"THR 25.5m",
                ils:{ rwy, cat:"CAT II", loc:"INJ", locF:108.5, gpF:329.9, dme:"INJ", note } } ],
    comms:[…], ils:[…] } ] }
```

来源 AD 2.12（跑道物理数据）/ 2.18（通信）/ 2.19（导航设施）。由 `build/gen-rwy-table.js` 生成，`build/merge-rwy.js` 回并进 `CN.json`。

### 4.4 `data/GROUND.json` / `data/TERM.json`（OSM 几何）

- `GROUND.json`：`{src, ap:{ ICAO: { rwy:[ring…], twy:[ring…], apn:[ring…], bd:[ring…] } }}` —— 环是 `[lat,lon]` 数组
- `TERM.json`：`{src, ap:{ ICAO: [ {r:[ring…], n:名称} ] }}`

抓取：Overpass / `/api/0.6/map`。**关键坑**：单个 bbox 超过 5 万节点会被 400 拒绝（`You requested too many nodes (limit is 50000)`），所以大机场要用紧 bbox 或多边形 relation。Douglas-Peucker 简化到 ~3 m（eps `0.000027`）。

---

## 5. 渲染层（`src/index.html`）

### 5.1 投影与坐标

```js
// 等距圆柱 + cos(lat0) 压缩
pt([lat,lon]) → x = (lon-lon0)*cos*scale,  y = -(lat-lat0)*scale
k  = proj.scale / 111320        // 世界单位 / 米
zc = zoom                       // 用户缩放
屏幕像素 ≈ px / zc              // 所以字号、描边都写成 px/zc
```

### 5.2 关键常量（改缩放行为先看这里）

| 常量 | 值 | 含义 |
|---|---|---|
| `DIAG_PPM` | `0.03` | 1px ≤ 33 m 时才画「完整机场图」+ 频率牌；否则只画空域/机场点 |
| `FS_K` | `0.84` | 空域频率标注字号总系数（`pushAir` 里乘一次，想整体调小/调大只改这里） |
| `APTDOT_K` | `0.78` | 机场圆点半径系数（基准 big 2.6 / 小场 1.9 CSS px） |
| `APTNAME_K` | `0.86` | 机场名（中文名 + ICAO）字号系数（基准 9.2 / 全国 7.8 CSS px） |
| 频率标注门限 | 区调 zc≥1.8 / 进近扇区 zc≥2.0 / 父区 zc≥2.2 / 塔台区 zc≥2.2 | 还要屏幕包围盒够大（区调 ≥54×26px、进近 ≥58×28px） |
| 叠层标注 | 几何完全相同的扇区/进近区合并成一块 | 标题 + 每个高度层一行，按高度自上而下 |
| 经纬网 | 步长自适应（20°→0.0005°，按视窗宽度取 1/6 的整数级步长） | `grid()` 在放大到机场尺度时仍画网格 + 度数标签，避免「放到最大一片空白」 |
| 空场提示 | `zc > 6` 且视窗（外扩 35%）内没有机场 | 地图中央显示「附近没有机场数据 · 可在频率总表里搜索机场」 |
| `MIN_MPP` | `2.2` | 最大倍率上限（2.2 m/px），`zoomCap()` 由此算 |
| `ZMIN / ZMAX` | `0.7 / 12000` | 缩放原始区间，实际受 `zoomCap()` 收敛 |
| 机场图触发 | 跑道 bbox 屏幕跨度 ≥ **110px** | `groundLayer()` 里的门限，防止全国视角出现灰碎块 |

### 5.3 主要函数

| 函数 | 作用 |
|---|---|
| `render(keepView)` | 主渲染：算 `vb`、拼 SVG 字符串（空域 → 道面 → 机场点/标注） |
| `groundLayer(zc, vb)` | 遍历机场，跨度够就调 `airportDiagram`，否则只留点 |
| `airportDiagram(a,g,zc,k,vb,lite)` | 画单场完整图：机坪/滑行道/跑道铺面/边线/中线/入口条纹/瞄准点/TDZ/跑道号/ILS 标注/塔台频率。跑道号按道面宽度定字号（`0.68×宽`，4.5–11px）画在入口内 52 m 处，像真实跑道号码标志；道面窄于 6px 不画。ILS 标牌整块甩到跑道端外侧（离端 ≥30 m，并按文字长度整体移出），绝不压道面和跑道号 |
| `runwaysOf(a,g)` | 跑道线位来源与清洗，顺序：`RWY.json` → AIP 补缺（优先 OSM 真实线位）→ 合成；清洗三件事：① 离本场 >6 km 的旧机场残留丢掉（如 ZBHH 旧白塔 08/26 离盛乐 46 km）；② OSM 兜底时跳过 rf 为空/重复的线位；③ 合成跑道与已画跑道同向、中心距 <450 m、长度接近则视为同一条（eAIP 改号如 02/20→03/21、04→04R 时只更新号码）；最后按 AIP 磁航向校正首尾，保证 `la` 号跑道端就是 `le`，跑道号不会画反 |
| `preview-diagram.js` | `node build/preview-diagram.js ZBHH [zc]` 把单个机场按真实缩放渲染成 SVG（含跑道号/ILS/塔台字），用于肉眼验收道面标注，输出 `build/.freq-check/<ICAO>-diag.svg` |
| `runwayLines()` | 旧的低倍率「跑道线」实现，**已不用**，保留未删 |
| `updateBoard(a)` | 右上角固定频率牌 `#aptBoard`，仅 `diagOn` 时按视口中心最近的机场显示 |
| `showArea/showSector/showTower` | 详情面板：主/备用频率、高度带、开放条件 |
| `jumpToAirport(id)` / `fitAirportZoom(a)` | 跳转到机场并算合适倍率（含深链 `#apt=ZBAA`） |
| `placeLabels(items, seed)` | 空域标注两遍避让：① 有旧落点（`LABEL_POS`）的标注先按原位占位，位置不漂移；② 其余按 ≤20 个多边形内部固定锚点找空位，挤不下时先省高度带、再省名称，最后只留频率；只放完整落在视窗内的标注（不裁字）；旧落点被面板/边缘挡住时**隐藏而不是换位**（只有文字块变高才允许重排一次），所以平移缩放时字不会乱跳；种子矩形包含浮层 UI（图层开关/图例/缩放/频率牌），换投影时清空落点缓存 |
| `anchorsInPoly(o)` | 多边形内部候选锚点（离边界远 + 靠形心排序），WeakMap 缓存，换投影自动失效 |
| 机场名摆放（`render` 内的机场循环） | 名字与自己的圆点保持「点半径 + 4px」的距离（不再压在点上）；候选位按 `点半径 + fs + 行距` 逐行外扩，找不到空位就不写字只留点；与其它名字/已放标注做 2px 内缩的重叠检查，宁可缺一个名字也不让两个字叠在一起 |
| `callShort / sectorShort / subCfg` | 单位简称、区调扇区短名、进近扇区跑道构型后缀 |
| `vband / vtop` | 高度带压缩显示（`12 500 m–7 800 m(exclusive)` → `12 500–7 800 m`）、高度上界排序 |
| `geomKey / mkLabelVariants` | 同几何分组（叠层）、标注版式降级序列 |
| `ctrKind` | AD 2.17 空域分类：只有塔台管制区/管制地带挂塔台频率，放油区/禁区/限制区不挂 |
| `placeLabels` 后面 `window.__labelStats` | 自检用：画出/丢弃数量、分层统计、丢弃名单 |
| `showAirport/showArea/showSector/showTower` | 点选后的详情面板 |
| `buildTable()` | 底部频率总表 |
| `loadPacks/usePack` | `localStorage` 里可挂额外数据包（`skywave.packs.v2`） |

### 5.4 绘制顺序（不要打乱）

1. 底图 / `border`
2. FIR 轮廓、进近区、区调扇区、塔台区、CTR（`!diagOn` 时才有填充，`diagOn` 时填充透明只留边）
3. `groundLayer()`：机坪 → 滑行道 → **航站楼**（`#233242` 填充 + `#5b7c96` 描边）→ 跑道铺面
4. 跑道标线、跑道号、ILS/TWR 小字
5. 机场点 + 标注（常显）

### 5.5 样式要点

- 深色底 `#0a0f16` 系；跑道铺面 `#2a3442` 系，边线亮灰，中线虚线
- 跑道号写在入口内 ~52 m；ILS 标 `CAT III 108.55`；多塔台频率才标 TWR 小字
- 所有描边/字号都除以 `zc`，否则缩放会变粗

---

## 6. 构建与预览

### 6.1 构建（改完源码必做）

```sh
cd ~/work/airspace
node build/build.js          # src/index.html + data/*.json → docs/index.html
                             #   + downloads/天际电波-单文件.html + apk/assets/index.html
cd apk && ./build.sh         # aapt → javac → d8 → zipalign → apksigner
cp 空域频率图.apk ../downloads/天际电波.apk
cp 空域频率图.apk /sdcard/Download/天际电波.apk
```

产出 APK 约 740 KB。签名 keystore 在 `apk/keystore.jks`（pass `airspace2026`）。
工具链在 `~/toolchain`（aapt/javac/d8/apksigner），`~/android.jar` 已就位。

### 6.2 预览服务器（都在 127.0.0.1）

| 端口 | 脚本 | 内容 |
|---|---|---|
| 3113 | `node build/serve-test.js` | `docs/index.html` 主界面预览 |
| 3114 | `node build/serve-gallery.js` | `~/道面自检.html` 82 场道面长廊 |
| 3112 | `node build/serve-rwy.js` | `~/全国机场跑道与频率.html` |

> **引擎重启会杀掉所有后台 node 进程**，预览打不开就重新起。用 `run_in_background` 起。

### 6.3 自检画廊

`node build/gen-diagrams.js` 会从 `src/index.html` 里用 `vm` 沙箱 **eval 真实函数**，把 82 个机场按真实投影/样式画成 SVG 拼页 → `~/道面自检.html`。
好处：改渲染逻辑后能一眼看全部机场有没有崩（NaN、空图、错位）。
注意：它的 SVG transform 必须和 App 一致 —— `translate(ox*(1-z)+tx, oy*(1-z)+ty) scale(z)`（早期写成 `-z*tx` 出过错）。

---

## 7. 下个周期更新数据（SOP 摘要，全文见 `docs/抓取流程.md`）

1. **登录** `www.eaipchina.cn`，token 存在 `work/eaip/session.json`（会过期，过期就重登）
2. 取数据包列表 → 找当前周期（如 `EAIP 2026-12 V1.3`）
3. 取目录树 → 批量抓 82 份 `AD 2.1/.2/.12/.17/.18/.19`
4. 抓 `ENR 2.1.1/.3/.5`（FIR / 区调扇区 / 进近区）
5. `node build/gen-rwy-table.js` → `data/AIRPORT_RWY.json` + `~/全国机场跑道与频率.csv/html`
6. `node build/merge-rwy.js` 回并 `CN.json`
7. `node build/build.js` → `apk/build.sh` → 升 `AndroidManifest.xml` 的 versionCode/Name

> curl 对这几个域名经常静默无输出 —— **用 node 的 `https.get`/`fetch`**，不要用 curl 排查。

---

## 8. 已知限制（都是真限制，别当 bug 修）

1. **eAIP 只有 83 个机场条目**，其中 ZWTN 只有航图、没有 AD 2 通信/跑道数据 → `CN.json` 实际 **82 个**。用户已明确：其余 ~176 个非公开机场不管。
2. **ZGSD 珠海完全不在 eAIP 包里**，无法补。
3. **OSM 取不到首都 T3 / 虹桥 T2** 等巨型 multipolygon 航站楼（bbox 5 万节点上限）。要补得改成 `/api/0.6/relation/{id}/full` 逐个取，现有 `build/fix-one-term.js` 是雏形。
4. 道面几何是 OSM 的，个别机场机坪/滑行道有缺块或旧数据。
5. 京津冀 / 长三角 / 珠三角 机场密集区，机场名在挤不下时会被省略（只留圆点），不会出现两个字叠在一起；
   想让更多名字显示出来，调小 `APTNAME_K` / `APTDOT_K` 或减少 `rowH`。
6. 区域视角（z≈2–4）一次性放不下所有区调标签：华北/华东会丢弃 25–45% 的低优先级标注（标注位置优先稳定，不再为了多放而挪来挪去），
   终端区视角（z≥20）基本能全标，个别小扇区（如广州 AP02/AP08 的跑道构型变体）会被挤掉；
   丢注释义见 `build/gen-freq-check.js` 的统计。
7. 中途 OSM 429 限流曾导致 15 个机场保留旧缓存；ZGDY、ZJQH 曾丢航站楼，用 `build/gen-term-fallback.js` 补回。
8. 高倍率下没有卫星底图 —— 是刻意去掉的（离线 + 体积）。

---

## 9. 下一步可以做的（按价值排）

1. **全国视角机场点改成按跑道真向的小箭头/短线（8px）** —— 既干净又能一眼看出跑道朝向（已向用户提过，未采纳/未做）
2. 补首都 T3、虹桥 T2 等缺失航站楼（relation/full 接口）
3. 区域视角被挤掉的扇区标注：可试“引线外挂”或按重要度预算控制数量
4. 机场详情面板加跑道剖面小图（当前只有文字）
5. 支持 eAIP 换周期时 diff 出「频率变更」清单

---

## 10. 提交历史（近期，从旧到新）

```
38c09d8 之后的本次改动：频率标注细化：主用频率 + 高度带、叠层扇区合并、塔台区按 AIP 分类、标注避让与自检
63fdc09 边界/点位描边与虚线按屏幕像素缩放，道面视角更快到位
8792085 用离线矢量机场道面图替代卫星底图
dbfdb97 机场图简化为跑道 + 对应频率
a80588b 机场道面做全（跑道铺面+滑行道+机坪+边界）
a334247 机场道面加航站楼轮廓
4aea05d 航站楼短标 T1/T2 落在楼内
ccbf592 航站楼只画轮廓，去掉 T1/T2 标字
2840f9b 机场图层常显（点 + 中文名 ICAO）
c5442de 低倍率也显示跑道线位
575c4fa 跑道线位全国视角起常显
1a06a92 频率只放在所属区块，机场标注不再带频率
69f3ea5 跑道频率牌改成固定悬浮卡片
0f6a6ac 更早切换完整道面，收敛最大倍率
2558af9 任何倍率都画完整机场图（不再用线代替）
38c09d8 全国视角不再画缩小的机场图   ← 当前 HEAD
```

---

## 11. 环境备忘（这台机器）

- 安卓容器，bionic，无 apt/systemd；node/busybox 工具链在 PATH
- 构建 APK 用 `~/toolchain`，`~/android.jar` 已 stage，**不需要下载**
- git 需 `-c safe.directory='*'`
- 没有显示器：预览一律 `node` 起 http 服务，回复里给 `http://127.0.0.1:<port>` 让用户点
- 别占用 3080 / 3083（引擎 WebUI / 能力桥）
- 任务完成可 `notify`；截图用 `scr shot --save` + `read_image`
