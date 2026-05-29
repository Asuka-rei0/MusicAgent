# MusicAgent 项目结构说明

## 项目概述

MusicAgent 是一个 Windows 桌面音乐播放器，采用 **WinForms + WebView2 混合架构**。WinForms 作为宿主窗口，内嵌 WebView2 渲染前端界面；后端使用 NAudio 进行音频播放，TagLibSharp 读取音乐元数据，SQLite 存储本地数据；前端使用 React + TypeScript + Tailwind CSS 开发，通过 Vite 构建后输出到 WinForms 的 wwwroot 目录。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面宿主 | WinForms (.NET 10) |
| 嵌入式浏览器 | Microsoft WebView2 |
| 前端框架 | React 18 + TypeScript |
| UI 组件库 | Radix UI + shadcn/ui + MUI |
| 样式方案 | Tailwind CSS 4 |
| 前端构建 | Vite 6 |
| 音频播放 | NAudio 2.3 |
| 元数据读取 | TagLibSharp 2.3 |
| 本地数据库 | SQLite (Entity Framework Core) |
| 云音乐集成 | NeteaseCloudMusicApi |

## 目录结构

```
MusicAgent/
├── .gitignore                  # Git 忽略规则
├── README.md                   # 项目说明文档
│
├── react/                      # 前端 React 源码
│   ├── aaudiocore/             # 音频核心库（TypeScript 版，供前端使用）
│   │   ├── src/
│   │   │   ├── contracts/      # 接口定义
│   │   │   ├── models/         # 数据模型
│   │   │   ├── services/       # 服务实现
│   │   │   ├── strategies/     # 播放策略
│   │   │   └── index.ts        # 模块入口
│   │   ├── tests/              # 单元测试（Vitest）
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── uipackage/              # 主 UI 包
│       ├── src/
│       │   ├── app/
│       │   │   ├── components/
│       │   │   │   ├── figma/              # Figma 导出组件
│       │   │   │   │   └── ImageWithFallback.tsx
│       │   │   │   ├── ui/                 # shadcn/ui 基础组件（40+）
│       │   │   │   │   ├── button.tsx
│       │   │   │   │   ├── dialog.tsx
│       │   │   │   │   ├── slider.tsx
│       │   │   │   │   └── ...
│       │   │   │   ├── views/              # 页面视图组件
│       │   │   │   │   ├── AIRecommendView.tsx   # AI 推荐
│       │   │   │   │   ├── ExploreView.tsx       # 发现/探索
│       │   │   │   │   ├── MusicLibraryView.tsx  # 音乐库
│       │   │   │   │   └── SettingsView.tsx      # 设置
│       │   │   │   ├── MainLayout.tsx      # 主布局（侧边栏+内容区）
│       │   │   │   └── MediaPlayerBar.tsx  # 底部播放控制栏
│       │   │   ├── contexts/
│       │   │   │   └── PlayerContext.tsx    # 播放器全局状态
│       │   │   ├── data/
│       │   │   │   └── demoTracks.ts       # 演示曲目数据
│       │   │   ├── interfaces/
│       │   │   │   ├── IMusicView.ts       # 视图接口定义
│       │   │   │   └── index.ts
│       │   │   └── App.tsx                 # 应用根组件
│       │   ├── styles/
│       │   │   ├── fonts.css               # 字体定义
│       │   │   ├── globals.css             # 全局样式
│       │   │   ├── index.css               # 样式入口
│       │   │   ├── tailwind.css            # Tailwind 配置
│       │   │   └── theme.css               # 主题变量
│       │   └── main.tsx                    # React 入口
│       ├── index.html                      # HTML 模板
│       ├── vite.config.ts                  # Vite 构建配置
│       ├── postcss.config.mjs              # PostCSS 配置
│       ├── package.json
│       └── pnpm-workspace.yaml
│
└── winforms/                   # WinForms 后端项目
    ├── aaudiocore/             # 音频核心库（C# 版，供后端使用）
    │   ├── Contracts/
    │   │   ├── IAudioService.cs          # 音频服务接口
    │   │   ├── IAudioStateObserver.cs    # 状态观察者接口
    │   │   └── IPlaybackStrategy.cs      # 播放策略接口
    │   ├── Models/
    │   │   ├── AudioState.cs             # 音频状态模型
    │   │   ├── PlayCommand.cs            # 播放命令模型
    │   │   ├── PlaybackStatus.cs         # 播放状态枚举
    │   │   └── PlaybackTrack.cs          # 播放曲目模型
    │   ├── Services/
    │   │   ├── BaseAudioService.cs       # 音频服务基类
    │   │   └── NAudioAudioService.cs     # NAudio 实现类
    │   ├── Strategies/
    │   │   ├── NormalStrategy.cs         # 顺序播放
    │   │   ├── RepeatStrategy.cs         # 单曲循环
    │   │   └── ShuffleStrategy.cs        # 随机播放
    │   └── AAudioCore.csproj             # 项目文件（.NET 10，依赖 NAudio）
    │
    └── uipackage/               # WinForms 主项目
        ├── wwwroot/              # WebView2 加载的前端页面
        │   ├── app.js            # 主前端逻辑（WinForms 运行时入口）
        │   ├── index.html        # 主页面（含完整 CSS 和 HTML 结构）
        │   ├── js/
        │   │   └── library-view.js   # 音乐库视图脚本
        │   ├── favicon.ico
        │   └── favicon.svg
        ├── AudioService.cs       # 音频播放服务（桥接 aaudiocore + NeteaseService）
        ├── DatabaseService.cs    # 数据库服务（SQLite + EF Core，设置/听歌历史）
        ├── DesktopLyricsForm.cs  # 桌面歌词窗口（置顶透明窗体）
        ├── FileService.cs        # 文件服务（音乐扫描/元数据/LRC歌词）
        ├── MainForm.cs           # 主窗体（WebView2 宿主，消息路由中心）
        ├── MusicAgentWinForms.csproj  # 项目文件（.NET 10 WinForms）
        ├── NeteaseApiProcessManager.cs # 网易云 API 进程管理器
        ├── NeteaseService.cs     # 网易云音乐服务（登录/同步/播放/歌词）
        └── Program.cs            # 程序入口
```

## 核心模块说明

### 1. 主窗体 — MainForm.cs

主窗体是整个应用的枢纽，负责：

- **WebView2 初始化**：将 `wwwroot` 目录映射到虚拟主机 `musicagent.app`，加载 `index.html`
- **消息路由**：通过 WebView2 的 `PostWebMessageAsString` / `WebMessageReceived` 机制，实现前端与后端的双向通信
- **窗口管理**：深色标题栏（DWM API）、沉浸式全屏模式、桌面歌词窗口生命周期
- **服务协调**：创建并协调 AudioService、DatabaseService、FileService、NeteaseService 四大服务

前端发送的每条消息格式为 `{ id, action, data }`，后端根据 `action` 字段路由到对应服务方法，返回 `{ id, action, data }` 响应。

### 2. 音频核心 — aaudiocore

aaudiocore 采用**策略模式**设计，在 C# 和 TypeScript 中保持一致的架构：

```
IAudioService (接口)
  └── BaseAudioService (基类，通用逻辑)
        └── NAudioAudioService (C# 实现，使用 NAudio)

IPlaybackStrategy (接口)
  ├── NormalStrategy   — 顺序播放
  ├── RepeatStrategy   — 单曲循环
  └── ShuffleStrategy  — 随机播放
```

- **C# 版** (`winforms/aaudiocore/`)：实际运行时使用，底层依赖 NAudio 进行音频解码和播放
- **TypeScript 版** (`react/aaudiocore/`)：前端开发时使用，提供 `WebAudioService`（浏览器 Audio API）和 `MockAudioService`（模拟）

### 3. 音频服务 — AudioService.cs

AudioService 是 aaudiocore 的上层封装，负责：

- **播放队列管理**：维护 `queueManifest` 列表，支持按索引播放
- **网易云歌曲解析**：将 `netease:songId:title` 格式的源 URI 解析为本地缓存路径
- **元数据覆盖**：优先使用网易云缓存的曲目信息覆盖本地文件名
- **播放状态报告**：将 AudioState 转换为前端可用的进度/状态数据

### 4. 文件服务 — FileService.cs

- **音乐扫描**：递归扫描指定目录，支持 mp3/wav/flac/aac/ogg/m4a/wma 格式
- **元数据读取**：使用 TagLibSharp 读取标题、艺术家、专辑、时长
- **LRC 歌词**：查找与音频文件同名同目录的 `.lrc` 文件
- **路径管理**：通过 `localpaths.json` 持久化用户添加的本地曲库路径

### 5. 数据库服务 — DatabaseService.cs

使用 Entity Framework Core + SQLite，管理以下数据：

| 表名 | 用途 |
|------|------|
| Settings | 应用设置（主题、自动播放、桌面歌词、上次播放状态） |
| ListeningHistory | 听歌历史记录（7天滚动，用于统计洞察） |
| NeteaseSession | 网易云登录会话（Cookie、用户信息） |
| NeteasePlaylist | 网易云歌单缓存 |
| NeteasePlaylistTrack | 网易云歌单曲目缓存 |

### 6. 网易云服务 — NeteaseService.cs

完整的网易云音乐集成，包括：

- **扫码登录**：QR Code 生成 → 轮询检查 → Cookie 持久化
- **歌单同步**：拉取用户歌单列表及曲目详情，缓存到 SQLite
- **歌曲播放**：首次播放时缓存到 `netease-cache` 目录，后续播放使用本地缓存
- **歌词获取**：在线歌词接口
- **发现/探索**：排行榜、心情标签、推荐歌单
- **搜索**：歌曲搜索功能

### 7. API 进程管理 — NeteaseApiProcessManager.cs

自动管理 NeteaseCloudMusicApi 的生命周期：

- **自动启动**：检测本机 npx，自动运行 `NeteaseCloudMusicApi@latest`
- **健康检查**：通过 `/login/status` 接口检测 API 是否就绪
- **状态报告**：向 UI 层反馈 API 服务的运行状态
- **进程清理**：应用退出时自动终止托管的 API 进程

### 8. 桌面歌词 — DesktopLyricsForm.cs

独立的置顶透明窗口：

- **透明背景**：使用 `TransparencyKey` 实现非文字区域完全透明
- **鼠标穿透**：`WS_EX_NOACTIVATE` + `WS_EX_TOOLWINDOW` 避免抢夺焦点
- **悬停交互**：鼠标悬停时显示关闭按钮和半透明背景
- **可拖拽**：支持鼠标拖拽调整位置

## 前后端通信机制

```
┌─────────────────┐     PostWebMessageAsString      ┌──────────────────┐
│   WebView2 UI   │ ──────────────────────────────► │   MainForm.cs    │
│  (index.html +  │                                  │  (消息路由中心)   │
│   app.js)       │ ◄────────────────────────────── │                  │
└─────────────────┘     PostWebMessageAsString      └──────────────────┘
                                                              │
                                        ┌─────────┬──────────┼──────────┐
                                        ▼         ▼          ▼          ▼
                                   AudioSvc  DatabaseSvc  FileSvc  NeteaseSvc
```

前端通过 `window.chrome.webview.postMessage()` 发送 JSON 消息，后端 `CoreWebView2_WebMessageReceived` 事件接收后，根据 `action` 字段路由到对应服务方法处理。

## 运行时生成的文件

以下文件在应用运行时自动生成，已被 `.gitignore` 排除：

| 文件/目录 | 位置 | 说明 |
|-----------|------|------|
| `musicagent.db` | 可执行文件目录 | SQLite 数据库（设置、历史、网易云缓存） |
| `localpaths.json` | 可执行文件目录 | 本地曲库路径配置 |
| `netease-cache/` | 可执行文件目录 | 网易云歌曲缓存 |
| `*.WebView2/` | 可执行文件目录 | WebView2 运行时缓存 |

## 构建与运行

### 环境要求

- Windows 10/11
- .NET 10 SDK
- Microsoft Edge WebView2 Runtime
- Node.js（网易云功能需要）

### 启动应用

```powershell
dotnet restore winforms/uipackage/MusicAgentWinForms.csproj
dotnet run --project winforms/uipackage/MusicAgentWinForms.csproj
```

### 构建前端（开发时）

```powershell
cd react/uipackage
pnpm install
pnpm build
```

构建产物输出到 `react/uipackage/dist/`，需手动复制到 `winforms/uipackage/wwwroot/` 以供 WinForms 加载。

### 启动网易云 API

```powershell
npx NeteaseCloudMusicApi@latest
```

默认地址 `http://127.0.0.1:3000`。应用也会在需要时自动尝试启动该服务。

## 双端 aaudiocore 架构

项目在 C# 和 TypeScript 中实现了对称的 aaudiocore 音频核心库：

```
react/aaudiocore/src/          winforms/aaudiocore/
├── contracts/                 ├── Contracts/
│   ├── audio-service.ts       │   ├── IAudioService.cs
│   ├── audio-state-observer.ts│   ├── IAudioStateObserver.cs
│   └── playback-strategy.ts   │   └── IPlaybackStrategy.cs
├── models/                    ├── Models/
│   ├── audio-state.ts         │   ├── AudioState.cs
│   ├── play-command.ts        │   ├── PlayCommand.cs
│   └── track.ts               │   └── PlaybackTrack.cs
├── services/                  ├── Services/
│   ├── base-audio-service.ts  │   ├── BaseAudioService.cs
│   ├── web-audio-service.ts   │   └── NAudioAudioService.cs
│   └── mock-audio-service.ts  │
└── strategies/                └── Strategies/
    ├── normal-strategy.ts         ├── NormalStrategy.cs
    ├── repeat-strategy.ts         ├── RepeatStrategy.cs
    └── shuffle-strategy.ts        └── ShuffleStrategy.cs
```

这种设计允许前端在浏览器中独立开发调试（使用 WebAudioService 或 MockAudioService），而生产环境通过 WebView2 消息机制与 C# 后端的 NAudioAudioService 交互。
