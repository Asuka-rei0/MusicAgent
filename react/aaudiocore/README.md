# A 分工：核心音频引擎第一阶段

这个文件夹是 MusicAgent 的 A 分工模块，负责 Model 层的音频播放核心。

第一阶段目标：

- 定义稳定的 `IAudioService` 契约。
- 用 `WebAudioService` 基于 `HTMLAudioElement` 实现网页端播放。
- 用 `MockAudioService` 模拟播放状态，方便 B/D 分工并行开发。
- 提供顺序、随机、单曲循环三种播放策略。
- 保持 UI 与底层播放器解耦，后续可以替换成 Tauri/mpv。

模块边界：

- A 负责音频加载、播放、暂停、停止、跳转、状态广播和播放策略。
- B 负责 UI 渲染。
- C 负责曲库扫描、元数据、数据库和统计。
- D 负责 Presenter、推荐算法和业务编排。

推荐使用：

```ts
import { WebAudioService, PlayCommandType } from "@music-agent/a-audio-core";

const audio = new WebAudioService();

audio.attachObserver({
  onAudioStateChanged: (state) => {
    console.log(state.status, state.currentMs, state.durationMs);
  }
});

audio.loadMedia("track-1", "/demo.mp3");
audio.executeCommand({ type: PlayCommandType.Play });
```

第二阶段升级方向：

- 新增 `TauriAudioService`。
- 通过 Tauri command/event 调用 Rust/mpv。
- 保持 `IAudioService` 不变，减少 UI 和 Presenter 改动。
