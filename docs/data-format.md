# 数据格式（`data/CN.json`）

一个文件就是全国数据集：机场 + 进近区/扇区 + 区调扇区 + 塔台区。
APP 顶部下拉框可切换/导入数据集；也可以在页面里点「导入」现场加载。

## 顶层

| 字段 | 类型 | 说明 |
|---|---|---|
| `meta` | obj | `{ cycle, effective, nextEffective, national, airports, sectors, areas }` |
| `site` | obj | `{ id:"CN", nameCn:"全国", nameEn:"CHINA" }` |
| `cycle` / `effective` / `nextEffective` | str | 数据周期与生效/失效日期 |
| `airports` | arr | 机场（见下） |
| `areas` | arr | 进近管制区与 APxx 扇区（见下） |
| `sectors` | arr | 区调扇区（见下） |
| `ctr` | arr | 塔台管制区等 ATS 空域 `{ icao, nameCn, nameEn, vertical, pts }` |

## 机场 `airports[]`

| 字段 | 说明 |
|---|---|
| `id` / `iata` | ICAO / IATA 代码 |
| `nameCn` / `nameEn` | 中英文场名，如「太原/武宿」 |
| `arp` | `[纬度, 经度]` 十进制度 |
| `arpText` | AIP 原文坐标，仅显示用 |
| `elev` / `magvar` | 标高、磁差（自由文本） |
| `comms` | `[{ type, cn, en, f, alt, time, note }]`，`f`/`alt` 单位 MHz |
| `navs` | `[{ id, type, f, lat, lon, loc, cn, rwy, note, time }]` |
| `runways` | `[{ d, dim, hdg, thr }]` |

`comms[].type` 取 AIP 的 `designation`：`TWR`/`GND`/`DEL`(`Delivery`)/`APN`/`RAMP`/`ATIS`/`APP`/`EMG`/`AOC`/`OP-CTL`。

## 进近区 `areas[]`

| 字段 | 说明 |
|---|---|
| `icao` | 所属机场（由 `locationIndicator` 前 4 位得到） |
| `loc` | 完整代码，如 `ZBYNAPP` / `ZBYNAP01E` |
| `nameCn` / `nameEn` | 名称，扇区形如 `AP01(东)` |
| `call` / `unit` | 呼号 / 值守单位 |
| `vertical` | 垂直范围（已去掉坐标、折叠破折号） |
| `freqs` | `[{ rank:PRIMARY/ALTERNATE, f, open, mode, note }]` |
| `pts` | `[[纬度, 经度], ...]` |
| `sub` | `true` 表示是 APxx 扇区（父区「XX进近」为 `false`） |

## 区调扇区 `sectors[]`

`{ loc, nameCn, nameEn, call, unit, vertical, freqs, pts }`。
`call` 是管制单位呼号（如「北京区域」），`unit` 是实际值守单位（如「太原区域管制室」）。

## 约定

- `pts` 一律是 `[[纬度, 经度], ...]` 十进制度，首尾一般已闭合。
- `vertical` 是自由文本，如 `GND–5100 m`、`7800 m–GND`。
- 频率字段不带单位，单位统一 MHz；ILS 下滑台/指点标也在 `navs` 里但不可用于通话。

## 新增/更新数据

按 [抓取流程.md](抓取流程.md) 抓原始数据 → `node build/gen-national.js` → `node build/build.js`。
只想临时看别的数据包，也可以用页面里的「导入」加载同格式 JSON。
