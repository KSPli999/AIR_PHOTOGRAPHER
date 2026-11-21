#!/system/bin/sh
set -e
export LD_LIBRARY_PATH="$HOME/toolchain/lib"
TC="$HOME/toolchain"
AJ="$HOME/android.jar"
JAVA="$TC/bin/java"
rm -rf build && mkdir -p build/classes build/dex

echo "[1/6] aapt 打包资源"
"$TC/bin/aapt" package -f -M AndroidManifest.xml -S res -A assets \
  -I /system/framework/framework-res.apk -F build/base.apk

echo "[2/6] javac"
"$TC/bin/javac" -nowarn -source 8 -target 8 -bootclasspath "$AJ" -classpath "$AJ" \
  -d build/classes src/app/airspace/MainActivity.java

echo "[3/6] d8 -> dex"
"$JAVA" -cp "$TC/share/java/d8.jar" com.android.tools.r8.D8 --lib "$AJ" --min-api 23 \
  --output build/dex $(find build/classes -name '*.class')

echo "[4/6] 组装"
cp build/base.apk build/unsigned.apk
cd build/dex && "$TC/bin/jar" uf ../unsigned.apk classes.dex && cd ../..

echo "[5/6] zipalign"
"$TC/bin/zipalign" -f 4 build/unsigned.apk build/aligned.apk

echo "[6/6] 签名"
if [ ! -f keystore.jks ]; then
  "$TC/bin/keytool" -genkeypair -keystore keystore.jks -storepass airspace2026 -keypass airspace2026 \
    -alias airspace -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Airspace Map, OU=DSH, O=Local, L=Taiyuan, ST=Shanxi, C=CN" 2>/dev/null
fi
"$JAVA" -jar "$TC/share/java/apksigner.jar" sign --ks keystore.jks --ks-pass pass:airspace2026 \
  --key-pass pass:airspace2026 --out 空域频率图.apk build/aligned.apk

"$JAVA" -jar "$TC/share/java/apksigner.jar" verify --print-certs 空域频率图.apk | head -4
echo "OK -> $(pwd)/空域频率图.apk  $(du -h 空域频率图.apk | cut -f1)"
