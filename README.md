# 空域频率图 · Airspace Frequency Map

中国民航空域无线电频率的可视化工具。当前数据集：**ZBYN 太原/武宿 + 北京管制区（ZBPE）42 个区调扇区**，
数据周期 **EAIP 2026-12 (V1.3)**，生效 2026-11-26，失效 2026-12-24（即 2611/12 期）。

## 三个产物

| 产物 | 位置 | 用途 |
|---|---|---|
| Android APP | `downloads/空域频率图.apk` | 手机上装，离线可用 |
| 单文件网页 | `downloads/太原空域频率图-单文件.html` | 双击即开，PC/手机都行，零依赖 |
| Windows exe 套件 | `downloads/山西空域频率图-桌面版.zip` | 拿到 PC 上跑 `build-exe.bat` 出 exe |

三者内容一致：同一份 `src/index.html` + 同一份 `data/ZBYN.json`。

## 目录

```
src/index.html        界面（唯一需要改 UI 的地方）
data/*.json           数据集，一个文件一个空域
build/gen.js          由 eAIP 原始 JSON 生成 data/*.json
build/build.js        把 index.html + data 合成单文件 HTML
build/serve.js        本地预览服务（127.0.0.1:3110）
apk/                  Android 工程（aapt + javac + d8 + apksigner，全在手机上构建）
desktop/              exe 打包套件（Node SEA）
docs/抓取流程.md      下个 AIRAC 周期怎么重新抓数据
```

## 重新构建

```bash
node build/gen.js          # 生成 data/ZBYN.json（需先按 docs 抓好原始 JSON）
node build/build.js        # 生成单文件 HTML
bash apk/build.sh          # 生成并签名 APK
```
APK 构建依赖 `$HOME/toolchain`（aapt/javac/d8/apksigner/zipalign/keytool）与 `$HOME/android.jar`，
`$HOME/toolchain/lib` 需要进 `LD_LIBRARY_PATH`。

## 扩展新空域

把新的 `data/XXX.json` 丢进去即可（字段见 `desktop/打包说明.md`）。
界面顶部有下拉框切换，也支持运行时「导入数据」。

## 免责

供模拟飞行、学习与资料核对。真实飞行以现行有效 AIP/NAIP 与管制指令为准。
ILS 下滑台（GP）与指点标频率为机载接收频率，不可用于通话。
