# 异步密语花园 · Cipher Garden

用 emoji + 旋转 + 花色在 5×5 花圃里种下「密语花」，分享链接给好友，让他们凭视觉记忆逆向解谜——猜对后花朵绽放，揭晓隐藏密语。

纯前端，无后端。谜题状态压缩在 URL 中（lz-string）。

## 在线体验

**GitHub Pages：** https://kangshengyang888-sketch.github.io/cipher-garden/

## 快速开始

### Windows（推荐）

双击 `start.bat`，会自动启动本地静态服务器并打开浏览器。

### 手动启动

在项目目录运行任意静态 HTTP 服务，例如：

```bash
# Python 3
python -m http.server 8080

# Node（需 npx）
npx serve .
```

然后访问 `http://localhost:8080`（端口以实际为准）。

> **注意**：因使用 ES Module，不能直接 `file://` 打开 `index.html`。

## 分享链接与二维码

生成分享链接时，URL 格式为：

```
{站点地址}#puzzle={压缩后的谜题数据}
```

- **线上（GitHub Pages）**：自动使用 `window.location.origin + pathname`，无需配置。
- **本地开发**：在 `js/config.js` 中设置 `PUBLIC_BASE_URL` 为 GitHub Pages 地址，这样本地生成的链接仍指向线上站点，好友可直接打开。

点击「生成分享链接」后：

1. 复制文本链接发给好友，或
2. 使用下方 **「微信扫码打开」** 二维码——用微信扫一扫即可在内置浏览器中打开完整链接（含 `#puzzle=…` 哈希段）。

标准分享与高清模式均使用同一线上地址，仅谜题数据长度与照片画质不同：

| 模式 | URL 上限 | 适用场景 |
|------|----------|----------|
| **标准分享** | 约 24000 字符 | 微信扫码（推荐）或聊天粘贴（≤2048 字符时较安全） |
| **高清模式** | 约 64000 字符 | 微信扫码打开，照片画质更好（默认推荐） |

> 微信聊天粘贴可能截断超过约 2048 字符的链接。**请优先使用二维码分享**，可携带完整谜题数据。

## 玩法

### 创作花园

1. 在左侧选择 emoji、旋转角度（0°/90°/180°/270°）、花色
2. 点击 5×5 格种植；再次点击相同组合可清除
3. 可选填写「密语」——支持三种形式：
   - **文字密语**：传统文字留言
   - **照片密语**：用相机拍一张照片或录制 3 秒短视频
   - **文字+照片**：文字与照片/视频组合
4. 点击「生成分享链接」，复制链接或微信扫码分享
5. 草稿自动保存到 localStorage

> **照片/视频说明**：照片导入时轻度压缩（最长边约 1920px）；生成链接时再按分享模式优化——标准模式目标约 24000 字符、高清模式约 64000 字符，HD 画质下限 0.65、最长边最高 2560px。若链接已符合上限则跳过二次压缩。视频最长 3 秒。媒体数据嵌入链接中（绝对上限约 64000 字符）。

### 解谜花园

1. 打开分享链接（URL 含 `#puzzle=...`），或切换到「解谜花园」粘贴链接
2. 观察目标花圃（只显示 parametric SVG 花朵，不显示 emoji 答案）
3. 在猜测区为每格选择 emoji / 旋转 / 花色
4. 共 **3 次**猜测机会，每格有 Wordle 式反馈：
   - **完全匹配**：emoji + 旋转 + 花色全对
   - **emoji 对 · 旋转/色错**：emoji 正确但旋转或花色不对
   - **emoji 在别格**：该 emoji 出现在其他位置
   - **不匹配**
5. 全部猜对 → 绽放动画 + 密语揭晓（文字、照片或短视频）

## 项目结构

```
cipher-garden/
├── index.html          # 主页面
├── style.css           # 花园主题样式
├── start.bat           # Windows 一键启动
├── server.ps1          # 本地 HTTP 服务
└── js/
    ├── main.js         # 入口与模式切换
    ├── config.js       # PUBLIC_BASE_URL（本地开发分享用）
    ├── constants.js    # 常量、调色板
    ├── codec.js        # URL 编解码（lz-string）
    ├── media.js        # 相机拍摄、压缩、媒体存储
    ├── flower.js       # parametric SVG 花朵生成
    ├── puzzle.js       # 猜测判定逻辑
    ├── create.js       # 创作模式
    └── solve.js        # 解谜模式
```

## 部署到 GitHub Pages

1. 推送代码到 GitHub 仓库 `main` 分支
2. 在仓库 Settings → Pages 中，Source 选 **Deploy from branch**，Branch 选 `main`，文件夹选 `/ (root)`
3. 部署完成后，将 `js/config.js` 中的 `PUBLIC_BASE_URL` 设为实际 Pages URL（本地开发时需要）

## 技术

- Vanilla HTML / CSS / JavaScript（ES Modules）
- [lz-string](https://github.com/pieroxy/lz-string)（CDN）压缩 URL 状态
- [qrcode](https://github.com/soldair/node-qrcode)（CDN）生成微信可扫二维码
- Parametric SVG：由 emoji + 旋转 + 花色哈希推导花瓣数、形状、渐变

## 许可

MIT
