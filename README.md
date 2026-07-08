# 网盘影视刮削重命名（netdisk-media-renamer）

> 在 [afeireal/cloud-disk-plugin](https://github.com/Lens-lzy/netdisk-media-renamer) 的基础上**改版**而来。
> 在保留其「网盘内批量重命名（剧集模式、正则模式、拖拽排序、自动集数）」核心能力的基础上，
> 面向**影视文件刮削**场景做了大量优化与新增，感谢原作者 afeireal 的开源工作（MIT）。

一个用于在网盘中批量重命名影视文件的油猴脚本，生成对 Plex / Emby / Jellyfin 等刮削器友好的命名
（如 `Show.Name.2024.S01E01`）。适配百度网盘、阿里云盘、夸克网盘、PikPak。

## 相比原版的改动

### 🐛 修复
- **图标错位**：全面改用svg的ICON图标，不适用emoji和字符

### ✨ 优化 / 新增
- **数字便宜**：数字补零里支持数字偏移量设置，统一加或减
- **框选文件**：支持鼠标框选多个文件，一次勾选多个文件。
- **Shift多选**：支持按 Shift 键点选开始和结束文件
- **布局优化**：调整为左右布局，样式美化，更易操作。

## 适用范围

- ✅ 百度网盘
- ✅ 阿里云盘
- ✅ 夸克网盘
- ✅ PikPak 云盘

## 安装

1. 安装 [Tampermonkey / 篡改猴](https://www.tampermonkey.net/)。
2. 安装脚本：打开 [netdisk-media-renamer.user.js](https://raw.githubusercontent.com/tsztodd/netdisk-media-renamer/main/netdisk-media-renamer.user.js) → Tampermonkey 会弹出安装页 → 安装。
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
