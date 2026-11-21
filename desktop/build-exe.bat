@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
echo ============================================
echo   山西空域频率图 - 打包为 Windows exe
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [x] 没找到 Node.js。请先安装 LTS 版： https://nodejs.org/
  echo     装完重开本窗口再运行一次。
  pause & exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo [i] Node 版本 %%v

if not exist "app.html" (
  echo [x] 缺少 app.html。请把 dist\太原空域频率图.html 复制到本目录并改名 app.html
  pause & exit /b 1
)
if not exist "data\" mkdir data
if not exist "data\ZBYN.json" (
  if exist "..\data.json" copy /y "..\data.json" "data\ZBYN.json" >nul
)

echo [1/4] 生成 SEA blob ...
node --experimental-sea-config sea-config.json || (echo [x] 生成失败 & pause & exit /b 1)

echo [2/4] 复制 node.exe ...
for /f "delims=" %%p in ('where node') do set NODEEXE=%%p
copy /y "!NODEEXE!" "山西空域频率图.exe" >nul || (echo [x] 复制失败 & pause & exit /b 1)

echo [3/4] 注入 blob（首次会联网下载 postject）...
npx --yes postject "山西空域频率图.exe" NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 || (
  echo [x] 注入失败，通常是网络问题。可先执行： npm i -g postject
  pause & exit /b 1
)

echo [4/4] 清理 ...
del /q sea-prep.blob >nul 2>nul

echo.
echo [OK] 已生成： 山西空域频率图.exe
echo      双击即可运行，会自动打开浏览器。
echo      扩展：把别的空域 JSON 丢进 data\ 目录，重新打开即可切换。
pause
