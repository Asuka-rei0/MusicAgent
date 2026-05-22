export interface TrackCard {
  title: string;
  artist: string;
  coverUrl: string;
  description?: string;
}

export interface ChatMessageModel {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string | Date;
  card?: TrackCard;
}

export interface AnalyticsPayload {
  playTimeMs: number;
  trackCount: number;
  weeklyTrend: Array<{ label: string; value: number }>;
  platformShare: Array<{ platform: string; value: number }>;
}

export interface IMusicView {
  /**
   * 每秒被 Presenter 调用多次，用于更新底部进度条的填充比例与时间文本。
   */
  updatePlaybackTimeline(currentMs: number, totalMs: number): void;

  /**
   * 接收歌曲基础信息，更新控制条左下角及全屏界面的专辑信息。
   */
  renderTrackMetadata(title: string, artist: string, coverUrl: string): void;

  /**
   * 在对话框中插入一条新的 AI 气泡，可能包含纯文本或推荐的曲目卡片。
   */
  showAIResponse(response: ChatMessageModel): void;

  /**
   * 接收聚合后的统计数据对象，将数据注入折线图与环形图中。
   */
  renderVisualizationDashboard(metrics: AnalyticsPayload): void;

  /**
   * 刷新设置页面的服务连接状态，控制登录/注销按钮的渲染逻辑。
   */
  updateServiceBindingStatus(platform: string, isBound: boolean, username: string): void;
}
