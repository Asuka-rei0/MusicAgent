# AGENTS.md

本文件适用于整个仓库。提交前请先确认改动落在哪条实现线：React 原型、TypeScript 音频核心、WinForms 桌面端，还是桌面端实际加载的 WebView 页面。

## 目录结构

- `react/aaudiocore/`：TypeScript 音频核心包，包含播放服务、播放策略、模型、契约与 Vitest 测试。
  - 核心代码：`react/aaudiocore/src/`
  - 测试：`react/aaudiocore/tests/`
  - 配置：`react/aaudiocore/package.json`、`tsconfig.json`
- `react/uipackage/`：React + Vite 前端原型。
  - 前端代码：`react/uipackage/src/`
  - 页面入口：`react/uipackage/index.html`
  - 配置：`package.json`、`vite.config.ts`、`postcss.config.mjs`、`pnpm-workspace.yaml`
  - 设计/说明：`react/uipackage/guidelines/`
- `winforms/aaudiocore/`：C# 音频核心项目。
  - 核心代码：`Contracts/`、`Models/`、`Services/`、`Strategies/`
  - 配置：`winforms/aaudiocore/AAudioCore.csproj`
- `winforms/uipackage/`：WinForms 桌面端宿主，集成 WebView2、SQLite、文件扫描、网易云 API 桥接等。
  - C# 后端/宿主代码：`Program.cs`、`MainForm.cs`、`AudioService.cs`、`DatabaseService.cs`、`FileService.cs`、`NeteaseService.cs`
  - 桌面端实际加载的前端页面：`winforms/uipackage/wwwroot/index.html`、`winforms/uipackage/wwwroot/app.js`
  - 配置：`winforms/uipackage/MusicAgentWinForms.csproj`
- 生成产物与本地运行数据不要提交：`node_modules/`、`dist/`、`build/`、`.vite/`、`bin/`、`obj/`、`coverage/`、`musicagent.db*`、`localpaths.json`、`*.WebView2/`、`EBWebView/`、日志文件。

## 常用命令

在 Windows PowerShell 中从仓库根目录执行：

```powershell
dotnet restore winforms/uipackage/MusicAgentWinForms.csproj
dotnet build winforms/uipackage/MusicAgentWinForms.csproj
dotnet run --project winforms/uipackage/MusicAgentWinForms.csproj
```

React 前端原型：

```powershell
cd react/uipackage
npm install
npm run dev
npm run build
```

TypeScript 音频核心：

```powershell
cd react/aaudiocore
npm install
npm run build
npm test
npm run test:watch
```

网易云相关功能需要本地 API 服务。该命令会下载/运行外部 npm 包并占用本机端口，通常默认使用 `3000`：

```powershell
npx NeteaseCloudMusicApi@latest
```

如端口被占用：

```powershell
npx NeteaseCloudMusicApi@latest --port 3001
```

当前仓库没有独立的 `generate` 脚本。需要生成的产物主要来自构建命令：

- `react/aaudiocore` 的 `npm run build` 生成 `dist/` 与类型声明。
- `react/uipackage` 的 `npm run build` 生成 Vite `dist/`。
- `dotnet build` 生成 `bin/`、`obj/`，并把 `winforms/uipackage/wwwroot/**` 复制到输出目录。

## 代码规范

- 优先沿用相邻文件风格；不要为局部改动引入新的框架、格式化体系或大范围重排。
- TypeScript 核心包启用 `strict`，公共契约集中在 `react/aaudiocore/src/contracts/`，模型集中在 `react/aaudiocore/src/models/`。
- TypeScript 核心包文件名使用 kebab-case，例如 `web-audio-service.ts`、`audio-state.ts`；接口/类型/枚举使用 PascalCase，例如 `IAudioService`、`AudioState`、`PlayCommandType`；对象字段使用 camelCase，例如 `durationMs`、`sourceUri`。
- React 组件使用 PascalCase，视图放在 `react/uipackage/src/app/components/views/`，上下文放在 `react/uipackage/src/app/contexts/`。继续使用现有 MUI、Radix/shadcn 风格组件、Tailwind 与 Vite 结构。
- `vite.config.ts` 中的 React、Tailwind 插件和 `@music-agent/a-audio-core` 本地源码别名是开发路径的一部分，不要随意删除或改向。
- C# 使用 `MusicAgentWinForms` 命名空间，类/方法/属性使用 PascalCase，异步方法以 `Async` 结尾。私有字段按所在文件现有风格命名。
- C# 项目启用 nullable 和 implicit usings。新增可空数据时要明确处理 null，不要依赖前端一定传入完整字段。
- WebView 消息协议是跨端边界：前端发送 `{ id, action, data }`，`action` 使用 lowerCamelCase 字符串，例如 `getAudioState`、`setQueue`、`neteaseQrStart`；复杂 `data` 通常作为 JSON 字符串传输。C# DTO 可继续使用 PascalCase 属性，并保持大小写兼容。
- 变更 `AudioState`、`PlaybackTrack`、`IPlayCommand`、`PlayCommandType`、`WebMessageRequest`、`WebMessageResponse` 或任何 `action` 名称时，必须同步所有调用方和测试。

## 提交要求

- 修改 `react/aaudiocore/src/` 中的播放状态、队列、策略、命令或 WebAudio 行为时，必须新增或更新 `react/aaudiocore/tests/` 下的 Vitest 测试，并运行 `npm test`。公共类型变更还要运行 `npm run build`。
- 修改 `react/uipackage/src/` 时，至少运行 `npm run build`。涉及播放、路由、全局状态或本地核心包集成时，也要考虑同步更新 `react/aaudiocore` 测试。
- 修改 `winforms/` C# 代码时，至少运行 `dotnet build winforms/uipackage/MusicAgentWinForms.csproj`。涉及 WebView 消息、数据库、文件扫描、播放控制或网易云同步时，建议启动桌面端做一次手动验收。
- 修改 `winforms/uipackage/wwwroot/` 时，要确认这是 WinForms 当前实际加载的页面。涉及消息协议时必须同步 `MainForm.HandleRequestAsync`、相关服务方法和前端解析逻辑。
- 修改 `package.json` 依赖或脚本时，必须同步对应 `package-lock.json`。本仓库已有 npm lockfile，不要混用包管理器生成新的 lockfile，除非是一次明确的迁移。
- 修改 `.csproj`、`vite.config.ts`、`tsconfig.json`、`.gitignore` 等配置时，在提交说明里写清影响范围，并运行对应构建命令。
- 纯文档改动通常不要求测试，但如果文档声明了命令或行为，需和当前仓库脚本保持一致。

## 风险边界

- 不要把 `winforms/uipackage/wwwroot/` 当作普通构建缓存删除；WinForms 通过 WebView2 实际加载这里的 `index.html` 和 `app.js`。
- 不要提交本地数据库、路径配置、WebView2 缓存、构建输出、依赖目录、日志或覆盖率报告。这些已在 `.gitignore` 中列出。
- 不要提交真实账号、cookie、API token、私人音乐库路径或机器专属配置。`.env`、`.env.*` 不应提交，只有 `.env.example` 可以提交。
- `dotnet run --project winforms/uipackage/MusicAgentWinForms.csproj` 会打开桌面窗口，运行时会写入输出目录下的 `musicagent.db`、`localpaths.json` 和 WebView2 缓存；窗口未关闭时可能锁定 `MusicAgentWinForms.dll` 或 `apphost.exe`，导致构建失败。
- `scanFolder` 会递归读取用户选择目录中的音频文件元数据，相关改动要注意性能、异常处理和隐私边界。
- `npx NeteaseCloudMusicApi@latest` 会访问网络、下载/运行最新 npm 包并启动本地服务；不要在自动化测试或无明确需要的流程中隐式启动。
- `npm install` 会修改 `node_modules/`，依赖变化还会修改 lockfile；仅在确实需要安装或更新依赖时运行。
- `npm run build` 会覆盖对应包的 `dist/`；`dotnet build` 会覆盖 `bin/`、`obj/` 并复制 `wwwroot` 到输出目录。
- 数据库结构目前由 `DatabaseService` 中的 `Ensure*` 方法维护，没有迁移项目。调整表结构或历史数据清理逻辑时要格外谨慎，并考虑旧 `musicagent.db` 的兼容性。
