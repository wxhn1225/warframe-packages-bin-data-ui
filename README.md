# Warframe Packages Browser

基于 [Sainan/warframe-packages-bin-data](https://github.com/Sainan/warframe-packages-bin-data) 子模块构建的路径浏览器，部署在 GitHub Pages 上。子模块有更新时本仓库自动同步并重新部署。

## 技术栈

- **前端**：React 19 + TypeScript + Vite 7 + Tailwind CSS v4
- **数据生成**：Rust（`tools/gen-trie`），将 44 万+ 路径按根目录分块
- **部署**：GitHub Pages + GitHub Actions

---

## 首次部署

### 1. 前置要求

本地需要安装：
- [Node.js](https://nodejs.org/) LTS
- [Rust](https://rustup.rs/)（运行 `rustup` 一键安装）
- Git

### 2. Fork / 创建仓库

将本仓库 fork 到你的 GitHub 账号，或直接使用本仓库。

### 3. 初始化子模块

```bash
git clone --recurse-submodules https://github.com/你的用户名/warframe-packages-bin-data-ui
cd warframe-packages-bin-data-ui
```

如果已经 clone 但没带子模块：

```bash
git submodule update --init --recursive
```

### 4. 安装依赖

```bash
npm install
```

### 5. 本地预览

```bash
npm run dev
```

首次运行会自动编译并执行 Rust 工具（约 30 秒），之后每次启动仅需 ~2 秒。构建完成后访问 `http://localhost:5173`。

### 6. 开启 GitHub Pages

1. 打开仓库 → **Settings → Pages**
2. Source 选择 **GitHub Actions**
3. 保存

### 7. 触发首次部署

推送任意提交到 `main` 分支，或手动触发：**Actions → Deploy to GitHub Pages → Run workflow**。

部署完成后访问 `https://你的用户名.github.io/warframe-packages-bin-data-ui/`。

---

## 后续更新

### 子模块自动同步

`.github/workflows/sync-submodule.yml` 每 **6 小时**自动检查上游子模块是否有新提交：

- 有更新 → 自动 commit + push（commit 消息与子模块原始提交消息相同）
- push 到 main → 自动触发 `deploy.yml` → Rust 重新生成数据块 → 重新部署

**整条链路无需任何手动操作。**

### 手动强制同步

如果不想等 6 小时，可以手动触发：**Actions → Sync Submodule → Run workflow**。

### 修改前端代码后部署

```bash
# 改代码
git add .
git commit -m "your message"
git push
```

push 到 main 即自动触发部署流程。

---

## 本地开发

```bash
# 只重新生成数据（子模块有更新后）
npm run generate

# 启动开发服务器（自动先跑 generate）
npm run dev

# 生产构建
npm run build

# 预览生产构建
npm run preview
```

### 目录结构

```
warframe-packages-bin-data-ui/
├── tools/
│   └── gen-trie/          # Rust 数据生成工具
│       ├── Cargo.toml
│       └── src/main.rs
├── public/
│   ├── chunks/            # 生成产物，不入 git
│   │   ├── Lotus.txt      # 各根目录的路径列表（按需懒加载）
│   │   └── ...
│   └── tree-meta.json     # 生成产物，不入 git
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── TreeNode.tsx
│   │   ├── TreePanel.tsx
│   │   └── DetailPanel.tsx
│   ├── lib/
│   │   ├── paths.ts        # 二分查找 / 路径导航
│   │   └── PathsContext.tsx # 懒加载分块管理
│   └── types/index.ts
├── .github/
│   └── workflows/
│       ├── deploy.yml         # 构建 + 部署
│       └── sync-submodule.yml # 自动同步子模块
└── warframe-packages-bin-data/ # 子模块（只读）
```

---

## 数据生成原理

Rust 工具 `tools/gen-trie` 遍历子模块中所有 `.json` 文件，按**根目录**分块输出：

| 分块文件 | 大小 | 说明 |
|---------|------|------|
| `Configs.txt` | ~1 KB | 极小 |
| `DS.txt` | ~1 KB | 极小 |
| `EE.txt` | ~390 KB | 中等 |
| `Engine.txt` | ~1 KB | 极小 |
| `Lotus.txt` | ~29 MB | 主体数据，按需加载 |
| `Tests.txt` | ~1 KB | 极小 |

页面初始只加载 `tree-meta.json`（几 KB），展开哪个根目录才下载对应分块，实现**秒开**。
