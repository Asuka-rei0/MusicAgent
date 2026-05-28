# MusicAgent WinForms 项目汇报文案

## 一、项目概述

本项目是一个基于 WinForms 的本地音乐播放器客户端，整体目标是实现本地音乐扫描、播放控制、播放队列管理、歌词读取、用户设置保存以及听歌数据统计等功能。项目采用“桌面壳 + Web 前端界面 + C# 本地服务”的结构：WinForms 负责承载应用窗口，WebView2 负责显示交互界面，C# 服务层负责访问系统文件、数据库和音频播放能力。

我主要负责的部分包括：

- `aaudiocore` 音频播放核心库
- `uipackage/AudioService.cs` 音频服务封装
- `uipackage/DatabaseService.cs` 数据持久化服务
- `uipackage/FileService.cs` 本地文件与歌词服务
- `uipackage/MainForm.cs` WinForms 主窗体与 WebView2 通信

## 二、整体设计思路

项目采用分层设计，尽量把界面展示、业务逻辑和底层能力拆开：

1. 表现层：前端页面运行在 WebView2 中，负责按钮、播放列表、进度条、设置页和统计图等交互展示。
2. 桥接层：`MainForm` 接收前端发送的 JSON 消息，根据 `action` 分发到不同服务，并把处理结果再返回给前端。
3. 业务服务层：`AudioService`、`FileService`、`DatabaseService` 分别处理播放控制、文件扫描和数据保存。
4. 音频核心层：`aaudiocore` 封装实际音频播放逻辑，提供统一接口、播放状态模型、播放命令和播放策略。

这样的设计好处是：前端不直接接触本地文件系统和数据库，所有本地能力都由 C# 服务统一管理；音频播放能力也从 UI 项目中抽离出来，后续如果更换 UI 或更换底层播放库，改动范围会比较小。

## 三、aaudiocore 音频核心模块

### 1. 模块职责

`aaudiocore` 是项目中的音频播放核心库，主要负责：

- 定义播放器统一接口 `IAudioService`
- 定义播放状态 `AudioState`
- 定义播放曲目模型 `PlaybackTrack`
- 定义播放命令 `PlayCommand`
- 管理播放队列和当前播放索引
- 支持普通播放、单曲循环、随机播放等策略
- 使用 NAudio 完成本地音频文件播放

### 2. 接口抽象

`IAudioService` 定义了播放器应该具备的基本能力，例如加载媒体、执行播放命令、跳转进度、设置队列、上一首、下一首和切换播放策略。

关键代码：

```csharp
public interface IAudioService : IDisposable
{
    AudioState GetState();
    IReadOnlyList<PlaybackTrack> GetQueue();
    int GetCurrentIndex();
    void LoadMedia(string trackId, string sourceUri);
    void ExecuteCommand(PlayCommand command);
    void SeekToPosition(double milliseconds);
    void SetQueue(IReadOnlyList<PlaybackTrack> queue, int startIndex = 0);
    bool PlayNext();
    bool PlayPrevious();
    void SetPlaybackStrategy(IPlaybackStrategy strategy);
}
```

这里使用接口的原因是为了降低耦合。UI 层只需要知道播放器支持哪些操作，而不需要关心底层是使用 NAudio、系统播放器还是其他播放引擎。

### 3. 播放状态模型

`AudioState` 使用 record 类型保存当前播放状态，包括当前曲目、播放地址、播放状态、当前进度、总时长、音量、播放倍速和错误信息。

```csharp
public sealed record AudioState
{
    public string? TrackId { get; init; }
    public string? SourceUri { get; init; }
    public PlaybackStatus Status { get; init; } = PlaybackStatus.Idle;
    public double CurrentMs { get; init; }
    public double DurationMs { get; init; }
    public float Volume { get; init; } = 1f;
    public float PlaybackRate { get; init; } = 1f;
    public string? ErrorMessage { get; init; }
}
```

使用不可变 record 的好处是状态更新更加清晰，例如通过 `state with { Status = PlaybackStatus.Playing }` 生成新状态，避免多个地方直接修改同一个对象造成状态混乱。

### 4. 基类管理队列和观察者

`BaseAudioService` 负责处理通用逻辑，例如播放队列、当前索引、播放策略和状态通知。真正的播放实现留给子类完成。

```csharp
protected bool LoadTrackAt(int index, bool autoplay = false)
{
    if (index < 0 || index >= queue.Count) return false;

    var track = queue[index];
    currentIndex = index;
    LoadMedia(track.Id, track.SourceUri);

    if (autoplay)
    {
        PlayLoadedMedia();
    }

    return true;
}
```

这段代码体现了队列播放的核心流程：先检查索引是否合法，再取出对应曲目，加载音频文件，如果需要自动播放就立即调用播放方法。上一首、下一首和播放模式切换最终都会落到这个队列加载逻辑上。

### 5. 播放策略设计

项目使用策略模式实现不同播放模式。`IPlaybackStrategy` 只需要提供一个 `SelectNext` 方法，根据当前索引和播放队列返回下一首歌曲的索引。

普通播放：

```csharp
public int SelectNext(int currentIndex, IReadOnlyList<PlaybackTrack> queue)
{
    if (queue.Count == 0) return -1;
    return currentIndex >= queue.Count - 1 ? 0 : currentIndex + 1;
}
```

单曲循环：

```csharp
public int SelectNext(int currentIndex, IReadOnlyList<PlaybackTrack> queue)
{
    if (queue.Count == 0) return -1;
    return Math.Max(0, Math.Min(currentIndex, queue.Count - 1));
}
```

随机播放：

```csharp
while (nextIndex == currentIndex)
{
    nextIndex = random.Next(queue.Count);
}
```

通过策略模式，新增播放模式时不需要改动播放器主体逻辑，只需要新增一个实现 `IPlaybackStrategy` 的类。

### 6. NAudio 播放实现

`NAudioAudioService` 继承 `BaseAudioService`，使用 `AudioFileReader` 读取音频文件，用 `WaveOutEvent` 输出声音。

关键加载逻辑：

```csharp
audioFile = new AudioFileReader(sourceUri)
{
    Volume = GetState().Volume
};

waveOut = new WaveOutEvent();
waveOut.PlaybackStopped += OnPlaybackStopped;
waveOut.Init(audioFile);
```

这段代码完成了三个关键步骤：

1. 打开本地音频文件，并同步当前音量。
2. 创建音频输出设备。
3. 绑定播放结束事件，用于自动切换下一首。

播放控制通过命令模式完成：

```csharp
case PlayCommandType.Play:
    PlayAudio();
    break;
case PlayCommandType.Pause:
    waveOut?.Pause();
    UpdateStateFromReader(PlaybackStatus.Paused);
    break;
case PlayCommandType.Next:
    PlayNext();
    break;
```

前端或上层服务只需要发送 `PlayCommand`，核心模块根据命令类型执行对应操作，结构比较清楚，也便于扩展更多命令。

## 四、AudioService 音频服务封装

### 1. 模块职责

`uipackage/AudioService.cs` 是 UI 层和 `aaudiocore` 之间的适配层，主要负责：

- 接收前端传来的 JSON 字符串
- 校验文件路径和队列数据
- 调用 `NAudioAudioService` 完成实际播放
- 把播放状态转换成前端可直接使用的 JSON 数据
- 支持播放、暂停、继续、停止、上一首、下一首、音量调整、进度跳转和播放模式切换

### 2. 播放入口

```csharp
var request = JsonSerializer.Deserialize<PlayRequest>(data, jsonOptions);
if (request == null || string.IsNullOrEmpty(request.FilePath))
{
    return CreateStateResponse("play", "Invalid file path.");
}

if (!File.Exists(request.FilePath))
{
    return CreateStateResponse("play", "File not found.");
}
```

播放前先反序列化前端数据，并检查文件路径是否合法、文件是否存在。这样可以避免把无效路径传给底层播放器，减少运行时异常。

当没有播放队列时，服务会自动把当前文件包装成一个 `PlaybackTrack` 并加入队列：

```csharp
audioCore.SetQueue(new[]
{
    new PlaybackTrack
    {
        Id = request.FilePath,
        SourceUri = request.FilePath,
        Title = Path.GetFileNameWithoutExtension(request.FilePath),
        Artist = "Local file"
    }
});
```

### 3. 播放队列设置

`SetQueue` 会过滤掉不存在的文件，只保留可以播放的本地曲目：

```csharp
var tracks = request?.Tracks?
    .Where(track => !string.IsNullOrWhiteSpace(track.SourceUri) && File.Exists(track.SourceUri))
    .Select((track, index) => new PlaybackTrack
    {
        Id = string.IsNullOrWhiteSpace(track.Id) ? track.SourceUri : track.Id,
        SourceUri = track.SourceUri,
        Title = track.Title,
        Artist = track.Artist,
        DurationMs = track.DurationMs
    })
    .ToList() ?? new List<PlaybackTrack>();
```

这里体现了服务层的数据清洗职责：前端传来的队列不一定完全可靠，后端需要保证进入播放器核心的数据是有效的。

### 4. 状态返回

`ToProgressPayload` 把核心层的 `AudioState` 转换成前端需要的字段：

```csharp
var progress = state.DurationMs > 0 ? state.CurrentMs / state.DurationMs * 100 : 0;

return new
{
    filePath = state.SourceUri ?? currentFilePath,
    status = state.Status.ToString(),
    progress,
    currentTime = state.CurrentMs / 1000,
    duration = state.DurationMs / 1000,
    volume = Math.Round(state.Volume * 100),
    isPlaying = state.Status == PlaybackStatus.Playing,
    currentIndex = audioCore.GetCurrentIndex(),
    queueCount = queue.Count,
    playbackStrategy,
    errorMessage = errorMessage ?? state.ErrorMessage
};
```

前端通常更关心百分比进度、秒级时间、是否正在播放等信息，因此这里做了一层格式转换，减少前端处理复杂度。

## 五、FileService 文件服务

### 1. 模块职责

`FileService` 负责本地音乐库相关功能：

- 扫描本地文件夹中的音乐文件
- 读取音频文件元数据
- 保存和读取用户添加的本地音乐路径
- 删除本地路径
- 根据音频文件查找同名 `.lrc` 歌词文件

### 2. 递归扫描音乐文件

```csharp
var musicExtensions = new[] { ".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma" };

foreach (var ext in musicExtensions)
{
    files.AddRange(Directory.GetFiles(folderPath, $"*{ext}", SearchOption.TopDirectoryOnly));
}

foreach (var subDir in Directory.GetDirectories(folderPath))
{
    files.AddRange(ScanForMusicFiles(subDir));
}
```

扫描时先匹配常见音频后缀，再递归进入子目录。对于没有权限访问的目录，代码会捕获 `UnauthorizedAccessException` 并跳过，保证扫描过程不会因为一个目录失败而整体中断。

### 3. 元数据读取

项目使用 `TagLibSharp` 读取歌曲标题、歌手、专辑和时长：

```csharp
using var file = TagLib.File.Create(filePath);
var title = string.IsNullOrWhiteSpace(file.Tag.Title) ? fallbackTitle : file.Tag.Title;
var artist = GetFirstNonEmpty(file.Tag.Performers)
    ?? GetFirstNonEmpty(file.Tag.AlbumArtists)
    ?? "Unknown Artist";
```

如果音频文件没有标签信息，就使用文件名作为标题、父文件夹作为专辑名，并把歌手标记为 `Unknown Artist`。这样即使音乐文件元数据不完整，也能在界面上正常展示。

### 4. 歌词读取

```csharp
var lyricPath = Path.ChangeExtension(audioPath, ".lrc");
if (string.IsNullOrWhiteSpace(lyricPath) || !File.Exists(lyricPath))
{
    return CreateLyricsResponse(false, audioPath, lyricPath ?? string.Empty, string.Empty, "No matching .lrc file found.");
}

var content = File.ReadAllText(lyricPath);
```

歌词功能采用本地同名 `.lrc` 文件匹配方式。例如 `song.mp3` 对应 `song.lrc`。这种方式实现简单，也符合本地音乐播放器的常见使用习惯。

## 六、DatabaseService 数据服务

### 1. 模块职责

`DatabaseService` 使用 SQLite 和 Entity Framework Core 进行本地数据持久化，主要负责：

- 创建并维护 `musicagent.db`
- 保存应用设置
- 读取应用设置
- 记录听歌时长
- 查询最近 7 天听歌数据
- 按平台统计听歌时长

### 2. 数据库初始化

```csharp
var dbPath = Path.Combine(Application.StartupPath, "musicagent.db");
var options = new DbContextOptionsBuilder<MusicDbContext>()
    .UseSqlite($"Data Source={dbPath}")
    .Options;
_context = new MusicDbContext(options);
_context.Database.EnsureCreated();
EnsureListeningHistoryTable();
DeleteOldListeningHistory();
EnsureSettings();
```

数据库文件放在程序启动目录下，便于随应用运行。启动时通过 `EnsureCreated` 自动创建数据库结构，再补充检查听歌历史表、清理旧数据、初始化默认设置。

### 3. 默认设置初始化

```csharp
if (!_context.Settings.Any())
{
    _context.Settings.Add(new AppSettings
    {
        Theme = "dark",
        AutoPlay = true,
        DesktopLyrics = false,
        ColorFollowAlbum = true
    });
}
```

当数据库中没有设置记录时，系统会创建一份默认配置，保证前端第一次启动时也能拿到完整配置。

### 4. 听歌记录与数据清理

```csharp
_context.ListeningHistory.Add(new ListeningHistory
{
    TrackPath = request.TrackPath,
    Platform = string.IsNullOrWhiteSpace(request.Platform) ? "Local" : request.Platform,
    ListenedAt = DateTime.Now,
    DurationSeconds = Math.Min(request.DurationSeconds, 300)
});
```

每次记录听歌时长时，会保存歌曲路径、平台、时间和本次听歌秒数。这里把单次记录限制在 300 秒以内，避免前端异常上报导致统计数据过大。

旧数据清理逻辑：

```csharp
var cutoff = DateTime.Today.AddDays(-6);
_context.ListeningHistory
    .Where(item => item.ListenedAt < cutoff)
    .ExecuteDelete();
```

项目只保留最近 7 天的听歌数据，既满足周统计需求，也避免数据库长期膨胀。

### 5. 周统计数据

```csharp
var data = Enumerable.Range(0, 7)
    .Select(offset =>
    {
        var date = since.AddDays(offset);
        var seconds = history
            .Where(item => item.ListenedAt.Date == date.Date)
            .Sum(item => item.DurationSeconds);

        return new WeeklyListeningData
        {
            Day = date.ToString("ddd"),
            Hours = Math.Round(seconds / 3600.0, 2)
        };
    })
    .ToList();
```

这段代码生成最近 7 天每天的听歌小时数，可直接用于前端图表展示。

## 七、MainForm 主窗体与通信机制

### 1. 模块职责

`MainForm` 是 WinForms 应用的入口窗口，主要负责：

- 初始化窗口大小和位置
- 创建并加载 WebView2
- 将 `wwwroot` 映射为虚拟域名
- 接收前端消息
- 根据 `action` 分发请求到对应服务
- 将服务返回结果发送回前端

### 2. WebView2 初始化

```csharp
webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
    "musicagent.app",
    Path.Combine(Application.StartupPath, "wwwroot"),
    CoreWebView2HostResourceAccessKind.Allow);
webView.CoreWebView2.Navigate("https://musicagent.app/index.html");
```

这里把本地 `wwwroot` 文件夹映射成 `https://musicagent.app`，前端页面可以像访问网站一样加载本地资源。这种方式比直接打开文件路径更接近真实 Web 环境，也方便处理静态资源。

### 3. 消息分发

```csharp
var message = e.TryGetWebMessageAsString();
var request = JsonSerializer.Deserialize<WebMessageRequest>(message, jsonOptions);
if (request == null) return;

var response = HandleRequest(request);
var responseJson = JsonSerializer.Serialize(response);
webView.CoreWebView2?.PostWebMessageAsString(responseJson);
```

前端通过 WebView2 发送 JSON 消息，后端解析成 `WebMessageRequest`，处理完成后再序列化为 JSON 返回。这个机制相当于在前端和 C# 后端之间建立了一套轻量级 RPC。

请求分发示例：

```csharp
return request.Action switch
{
    "play" => audioService.Play(request.Data),
    "pause" => audioService.Pause(),
    "scanFolder" => fileService.ScanFolder(request.Data),
    "getSettings" => dbService.GetSettings(),
    "recordListeningTime" => dbService.RecordListeningTime(request.Data),
    _ => new WebMessageResponse { Id = request.Id, Action = request.Action, Data = "Unknown action" }
};
```

使用 `switch` 表达式集中管理所有前后端交互入口，代码直观，调试时也容易定位某个功能对应的后端方法。

## 八、关键技术总结

项目中使用的关键技术包括：

- WinForms：提供 Windows 桌面应用窗口。
- WebView2：承载现代 Web 前端界面，实现桌面应用和 Web UI 结合。
- NAudio：负责本地音频文件读取和播放输出。
- Entity Framework Core：使用面向对象方式操作数据库。
- SQLite：作为本地轻量级数据库保存设置和听歌记录。
- TagLibSharp：读取音频文件标题、歌手、专辑、时长等元数据。
- JSON 消息通信：前端和 C# 后端通过 `action + data` 的结构进行通信。
- 策略模式：实现普通播放、随机播放、单曲循环等播放模式。
- 命令模式：通过 `PlayCommand` 统一封装播放、暂停、下一首、音量调整等操作。

## 九、个人负责模块亮点

1. 音频核心解耦  
   将播放核心拆分到 `aaudiocore` 项目中，通过接口、状态模型和命令模型统一管理播放能力，提高了复用性和可维护性。

2. 播放策略可扩展  
   使用策略模式管理播放顺序，后续新增“列表循环”“随机不重复”等模式时，只需要新增策略类。

3. 前后端通信清晰  
   `MainForm` 统一负责 WebView2 消息接收和分发，前端只需要发送 `action`，后端根据动作调用对应服务。

4. 本地音乐库功能完整  
   `FileService` 实现了文件夹扫描、元数据读取、路径保存、歌词匹配等功能，让播放器具备本地音乐管理能力。

5. 数据统计有持久化支持  
   `DatabaseService` 使用 SQLite 保存用户设置和听歌历史，并提供周统计、平台统计等接口，为数据可视化提供基础。

## 十、汇报时可用的简短总结

我的工作重点是把本地播放器的核心能力从界面中拆出来，形成“音频核心 + 本地服务 + WebView2 通信”的结构。`aaudiocore` 负责真正的播放状态、队列和策略控制；`AudioService` 把核心能力包装成前端可调用的接口；`FileService` 管理本地音乐文件和歌词；`DatabaseService` 保存设置和听歌统计；`MainForm` 则作为 WinForms 与 Web 前端之间的通信桥梁。整体设计兼顾了功能完整性和后续扩展性。
