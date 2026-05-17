# MusicAgent

MusicAgent 是一个 Windows 桌面音乐播放器原型，使用 WinForms 承载 WebView2 界面，底层播放基于 NAudio，本地数据使用 SQLite 保存。

## 环境要求

- Windows
- .NET 10 SDK
- Microsoft Edge WebView2 Runtime

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
