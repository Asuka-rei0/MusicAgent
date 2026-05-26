# MusicAgent

MusicAgent 是一个 Windows 桌面音乐播放器原型，使用 WinForms 承载 WebView2 界面，底层播放基于 NAudio，本地数据使用 SQLite 保存。

## 环境要求

- Windows
- .NET 10 SDK
- Microsoft Edge WebView2 Runtime
- Node.js（使用网易云登录、同步或未缓存歌曲播放时需要）

## 启动网易云 API 服务

如果要使用网易云登录、歌单同步、歌词获取或播放未缓存的网易云歌曲，需要先启动本机的 `NeteaseCloudMusicApi` 服务：

```powershell
npx NeteaseCloudMusicApi@latest
```

默认服务地址是：

```text
http://127.0.0.1:3000
```

启动后保持该 PowerShell 窗口打开，再启动 MusicAgent。若 3000 端口被占用，可以换端口：

```powershell
npx NeteaseCloudMusicApi@latest --port 3001
```

然后在应用设置页把网易云 API 地址改为 `http://127.0.0.1:3001`。已经同步过的歌单可以离线显示；未缓存歌曲、扫码登录、重新同步和在线歌词仍需要该 API 服务运行。

## 启动 WinForms 项目

在仓库根目录执行：

```powershell
dotnet restore winforms/uipackage/MusicAgentWinForms.csproj
dotnet run --project winforms/uipackage/MusicAgentWinForms.csproj
```

WinForms 会加载下面目录中的前端页面：

```text
winforms/uipackage/wwwroot
```

## 前端代码说明

- `react/` 是 React 版本的 UI 开发源码。
- `winforms/uipackage/wwwroot/` 是 WinForms 项目通过 WebView2 实际加载的前端页面。
- 如果只阅读 WinForms 项目的前端部分，重点看 `winforms/uipackage/wwwroot/app.js`，同时简单了解 `winforms/uipackage/wwwroot/index.html` 即可。

## 构建项目

```powershell
dotnet build winforms/uipackage/MusicAgentWinForms.csproj
```

如果构建时报 `MusicAgentWinForms.dll` 或 `apphost.exe` 正在被占用，通常是因为程序还在运行。关闭 MusicAgent 窗口后重新构建即可。

## 本地数据

运行时文件会生成在可执行文件所在目录，Debug 模式下一般是：

```text
winforms/uipackage/bin/Debug/net10.0-windows
```

常见生成文件：

- `musicagent.db`：本地 SQLite 数据库
- `localpaths.json`：保存的本地曲库路径
- WebView2 运行缓存目录

这些运行时文件已被 `.gitignore` 忽略，不需要提交。

## 功能说明

- 本地音乐扫描使用 TagLibSharp 读取歌曲标题、艺术家、专辑和时长等元数据。
- 音频播放通过 `aaudiocore` 项目封装，底层使用 NAudio。
- 歌词会读取音频文件同目录下的同名 `.lrc` 文件，例如 `song.mp3` 对应 `song.lrc`。
