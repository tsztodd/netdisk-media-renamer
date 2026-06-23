# 网盘影视刮削重命名（netdisk-media-renamer）

> 在 [afeireal/cloud-disk-plugin](https://github.com/afeireal/cloud-disk-plugin) 的基础上**重构改版**而来。
> 在保留其「网盘内批量重命名（剧集模式、正则模式、拖拽排序、自动集数）」核心能力的基础上，
> 面向**影视文件刮削**场景做了大量优化与新增，感谢原作者 afeireal 的开源工作（MIT）。

一个用于在网盘中批量重命名影视文件的油猴脚本，生成对 Plex / Emby / Jellyfin 等刮削器友好的命名
（如 `Show.Name.2024.S01E01`）。适配百度网盘、阿里云盘、夸克网盘、PikPak。

## 相比原版的改动

### 🐛 修复
- **预览/改名时整机卡死**：逐字符 Myers 差分（最坏 O(N²)、每字符一个 DOM 节点）改为 O(N) 前后缀差分，并对输入做防抖；不再在 50/150 个文件时阻塞主线程。
- **正则大面积漏匹配**：修复带 `g` 标志的正则在循环中 `.test()` 推进 `lastIndex` 的有状态 bug。
- **100 集以上预览空白/崩溃**：修复 `complementZero` 在数字位数超出时 `"0".repeat(负数)` 抛异常。
- **默认全选**：改为读取网盘当前已勾选的文件，仅预选这些（带安全回退）。

### ✨ 优化 / 新增
- **居中弹窗**：从底部贴边改为屏幕居中的缩放弹窗。
- **集数来源可选**：默认从**原文件名**提取集数（`12.mkv → E12`，不再被列表顺序带偏），可切换为按顺序。
- **正则积木（可视化）**：不懂正则也能用——删除文字 / 查找替换 / 删括号内容 / 数字补零 / 加前后缀 等积木自由拼装，同时保留高级原始正则。
- **TMDB 搜索**：剧集模式内联网搜索剧名，一键生成 `剧名.年份`，配合季数+自动集数得到 `Show.Name.Year.S01E01`。需自行在 [themoviedb.org](https://www.themoviedb.org/settings/api) 申请免费 API Key 并填入（保存在本地，不外泄）。

## 适用范围

- ✅ 百度网盘
- ✅ 阿里云盘
- ✅ 夸克网盘
- ✅ PikPak 云盘

## 安装

1. 安装 [Tampermonkey / 篡改猴](https://www.tampermonkey.net/)。
2. 安装脚本：打开 [netdisk-media-renamer.user.js](https://raw.githubusercontent.com/Lens-lzy/netdisk-media-renamer/main/netdisk-media-renamer.user.js) → Tampermonkey 会弹出安装页 → 安装。
3. 之后作者在仓库更新版本，Tampermonkey 会自动检测并更新（@updateURL 指向本仓库 main 分支）。

## 使用方法

1. 在网盘文件页点击「重命名」按钮打开面板。
2. 选择模式：**剧集模式** / **积木模式** / **正则(高级)**。
3. 配置规则，预览实时更新；勾选要改名的文件。
4. 点击 **应用** 开始重命名。

### TMDB 配置

1. 登录 [themoviedb.org](https://www.themoviedb.org) → [API 设置](https://www.themoviedb.org/settings/api) 申请 **API Key (v3)** 或 **Read Access Token (v4)**。
2. 剧集模式 → 点 🔑 → 粘贴并保存（存于浏览器本地）。

## 开发 / 构建

```bash
npm install
npm run dev:tamper-monkey     # 开发
npm run build:tamper-monkey   # 构建（产物在 dist/build/tamper-monkey/）
npm run test                  # 单元测试
```

发布新版本（触发用户端自动更新）：

```bash
# 1) 改 package.json 与 .env 里的 version
# 2) 构建并刷新仓库根的 user.js
npm run build:tamper-monkey
cp "dist/build/tamper-monkey/netdisk-media-renamer.user.js" netdisk-media-renamer.user.js
# 3) 提交并推送到 main
git add -A && git commit -m "release vX.Y.Z" && git push
```

## 致谢 & 许可

- 原始项目：[afeireal/cloud-disk-plugin](https://github.com/afeireal/cloud-disk-plugin)（MIT）。
- 本项目同样以 **MIT** 许可发布，`LICENSE` 中保留原作者版权声明。
