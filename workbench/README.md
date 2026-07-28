# 漫漫的工作台（PWA）

一个纯前端个人工作台：英语备考、健身、自媒体、知识库、资金规划、日历日程、播客等模块，可安装到手机主屏幕（PWA），数据支持手机/电脑通过 GitHub 云同步。

## 部署到 GitHub Pages（永久不休眠）

1. 在 GitHub 新建一个仓库（**建议选 Private 私有**，数据更安全）。
2. 把本目录下的**全部文件**（`index.html`、`style.css`、`app.js`、`data.js`、`sw.js`、`manifest.json`、`icons/`）上传到仓库**根目录**。
   - 方式一：仓库页面直接把文件拖进去提交。
   - 方式二：用 GitHub Desktop / git 推送。
3. 仓库 **Settings → Pages → Build and deployment → Source 选 "Deploy from a branch"**，Branch 选 `main`、目录选 `/ (root)`，点 Save。
4. 等 1~2 分钟，访问 `https://<你的用户名>.github.io/<仓库名>/` 即可。

> 也可在 WorkBuddy 里连接 GitHub 连接器，让小顾直接帮你推上去。

## 开启手机/电脑云同步

1. 打开工作台 → 左下角「🛠 通用工具」→「⚙️ 设置」→ 滑到最底「☁️ 云同步（GitHub）」。
2. 勾选「启用云同步」，填：
   - **owner**：你的 GitHub 用户名
   - **repo**：上面的仓库名
   - **Token**：GitHub → Settings → Developer settings → Personal access tokens → 生成（勾 `repo` 权限）
   - 文件名默认 `data.json`
3. 点「保存并测试」→ 显示「连接成功」后点「立即同步」。
4. **手机和电脑都填同一组 owner/repo/Token**，之后任意一端改动，2~3 秒后另一端打开会自动拉取最新数据。

> Token 只存在你本机浏览器，不会被上传；数据文件 `data.json` 存在仓库里（私有仓库仅你自己可见）。

## 本地开发

纯静态，无需构建。直接双击 `index.html` 即可在浏览器打开（部分浏览器对 Service Worker 要求 https，本地用 `python -m http.server` 起一个本地服务更稳）。

## 目录结构

- `index.html` — 页面骨架 + PWA 注册
- `style.css` — 薄荷绿主题样式
- `app.js` — 全部逻辑（模块路由、记账、日程、云同步等）
- `data.js` — 词库、长难句、热点池等静态数据
- `sw.js` — Service Worker（网络优先，自动接管）
- `manifest.json` — PWA 清单
- `icons/` — 图标
