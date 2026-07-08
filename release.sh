#!/usr/bin/env bash
# 发版一条龙：升版本号 → 构建 → 拷贝到仓库根 → 提交并推送。
# 推送后油猴会在几分钟内通过 @updateURL 检测到新版本并自动更新。
#
# 用法：  ./release.sh 2.0.1
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "用法: ./release.sh <新版本号>，例如 ./release.sh 2.0.1"
  exit 1
fi

VERSION="$1"
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "版本号格式应为 x.y.z，例如 2.0.1"
  exit 1
fi

echo "==> 更新版本号到 $VERSION"
# package.json 的 "version": "..."
sed -i '' -E "s/(\"version\": \")[0-9]+\.[0-9]+\.[0-9]+(\")/\1${VERSION}\2/" package.json
# .env 的 VITE_VERSION = "..."
sed -i '' -E "s/(VITE_VERSION = \")[0-9]+\.[0-9]+\.[0-9]+(\")/\1${VERSION}\2/" .env

echo "==> 构建"
npm run build:tamper-monkey

echo "==> 拷贝产物到仓库根"
cp "dist/build/tamper-monkey/netdisk-media-renamer.user.js" "netdisk-media-renamer.user.js"

echo "==> 提交并推送"
git add -A
git commit -m "release v${VERSION}"
git push origin main

echo "✅ 已发布 v${VERSION}。安装/更新链接："
echo "   https://raw.githubusercontent.com/tsztodd/netdisk-media-renamer/main/netdisk-media-renamer.user.js"
