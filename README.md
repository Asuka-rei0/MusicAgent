## 项目结构
```
MusicAgentWinForms/
├── MusicAgentWinForms.csproj    # 
项目文件
├── Program.cs                   # 
程序入口
├── MainForm.cs                  # 
WinForms主窗口 + WebView2
├── AudioService.cs              # 
NAudio音频播放服务
├── DatabaseService.cs           # 
EF Core + SQLite数据库服务
├── FileService.cs               # 
文件操作服务
└── wwwroot/                     # 
前端文件
    ├── index.html               # 
    主页面
    └── app.js                   # 
    前端应用逻辑
```


## 核心技术亮点
1. 前后端通信桥接
   
   - 前端通过 window.chrome.webview.postMessage() 发送消息
   - C#后端通过 CoreWebView2.WebMessageReceived 接收并处理
   - JSON序列化实现数据交换
2. 音频播放（NAudio）
   
   - 支持播放/暂停/停止/进度跳转/音量控制
   - 自动进度定时器更新
3. 数据库（EF Core + SQLite）
   
   - 播放列表、歌曲、统计数据持久化
   - 自动种子数据初始化
4. 文件操作
   
   - 递归扫描本地音乐文件夹
   - 支持 mp3/wav/flac/aac/ogg/m4a/wma 格式
   - JSON配置文件持久化
## 运行方式
```
cd d:\MusicAgent\MusicAgentWinForms
dotnet run
```
程序会启动一个 WinForms 窗口，内部嵌入 WebView2 渲染前端界面，所有业务逻辑由 C# 后端处理。
