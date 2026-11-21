# 数据格式（`data/*.json`）

一个 JSON 文件对应一个空域或机场。APP 顶部下拉框切换；也可以在页面里点「导入数据」现场加载。

## 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `site` | obj | `{ id, nameCn, nameEn }`，`id` 用 ICAO 码 |
| `cycle` / `meta.cycle` | str | 数据周期，如 `EAIP 2026-12 (V1.3)` |
| `arp` | `[lat, lon]` | 机场基准点，十进制度 |
| `arpText` | str | 原文坐标，仅用于显示 |
| `comms` | arr | 通信设施：`{ type, cn, en, f, alt, time }`，`f`/`alt` 单位 MHz |
| `navs` | arr | 导航设施：`{ id, type, f, lat, lon, location, note }` |
| `tma` | obj | 进近管制区：`{ nameCn, vertical, pts }` |
| `ctr` | arr | 塔台管制区等小区域：`{ nameCn, vertical, pts }` |
| `sectors` | arr | 区调扇区：`{ nameEn, unit, call, freqs:[{rank,f,open}], vertical, pts, tyn }` |
| `runways` | arr | 跑道：`{ d, dim, hdg, thr }` |
| `points` | arr | 可选，自定义点：`{ name, lat, lon, freq, kind }` |

约定：

- `pts` 一律是 `[[纬度, 经度], ...]` 十进制度，首尾不必闭合。
- `tyn: true` 的扇区用高亮色并常显标注。
- `vertical` 是自由文本，如 `GND–5100 m`、`7800 m–GND`。

## 最小示例

```json
{
  "site":  { "id": "ZBSJ", "nameCn": "石家庄/正定", "nameEn": "SHIJIAZHUANG" },
  "cycle": "EAIP 2026-12",
  "arp":   [38.2807, 114.6964],
  "comms": [
    { "type": "TWR", "cn": "石家庄塔台", "f": "118.35", "alt": "124.75", "time": "H24" }
  ],
  "navs": [
    { "id": "SJW", "type": "VOR/DME", "f": "117.70", "lat": "N38°16.9′", "lon": "E114°41.6′" }
  ],
  "tma": {
    "nameCn": "石家庄进近", "vertical": "GND–5100 m",
    "pts": [[38.10, 114.20], [38.60, 114.90], [37.95, 115.10]]
  },
  "ctr": [
    { "nameCn": "塔台管制区", "vertical": "SFC–1500 m",
      "pts": [[38.20, 114.40], [38.36, 114.62], [38.20, 114.90], [38.04, 114.62]] }
  ],
  "sectors": [
    { "nameEn": "AR07", "unit": "北京区域管制中心", "call": "北京区域",
      "freqs": [{ "rank": "PRIMARY", "f": "127.70" }, { "rank": "ALTERNATE", "f": "120.70" }],
      "vertical": "12500 m–GND", "pts": [[38.0, 113.5], [39.0, 114.0], [38.4, 115.0]], "tyn": false }
  ]
}
```

## 新增一个数据集

1. 按 [抓取流程.md](抓取流程.md) 抓 `AD_AIP` / `APPAREA` / `CTAAREA` 三份原始数据。
2. `node build/gen.js` 生成 `data/ZBYN.json`（换机场改脚本里的 ICAO 与文件名）。
3. 丢进 `data/` 后重新打包 APK；也可以用页面里的「导入数据」临时加载。
