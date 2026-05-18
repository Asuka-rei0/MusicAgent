import type { IMusicView, ChatMessageModel, AnalyticsPayload } from '../interfaces/IMusicView';
import { RecommendationEngine, type TrackFeatures, type UserFeedback } from './recommendationEngine';
import { AIChatService, type AIChatConfig } from './aiChatService';
import type { ConversationMessage, ConversationSession } from './conversationManager';

export interface PlaybackState {
  isPlaying: boolean;
  currentMs: number;
  totalMs: number;
  volume: number;
  currentTrackId: string | null;
  playbackStrategy: 'normal' | 'shuffle' | 'repeat';
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  autoPlay: boolean;
  desktopLyrics: boolean;
  colorFollowAlbum: boolean;
}

export class MusicPresenter {
  private view: IMusicView | null = null;
  private recommendationEngine: RecommendationEngine;
  private aiChatService: AIChatService | null = null;
  private playbackState: PlaybackState;
  private settings: AppSettings;
  private currentPlaylist: TrackFeatures[] = [];
  private currentPlaylistIndex: number = 0;
  private playbackHistory: string[] = [];
  private progressTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.recommendationEngine = new RecommendationEngine();
    this.playbackState = {
      isPlaying: false,
      currentMs: 0,
      totalMs: 390000,
      volume: 70,
      currentTrackId: null,
      playbackStrategy: 'normal',
    };
    this.settings = {
      theme: 'dark',
      autoPlay: true,
      desktopLyrics: false,
      colorFollowAlbum: true,
    };
  }

  initializeAIChat(config: AIChatConfig): void {
    this.aiChatService = new AIChatService(config);

    this.aiChatService.setConversationCallbacks({
      onMessageUpdate: (message) => {
        this.handleChatMessageUpdate(message);
      },
      onStreamChunk: (_messageId, chunk) => {
        this.handleStreamChunk(chunk);
      },
      onError: (_messageId, error) => {
        this.handleChatError(error);
      },
    });
  }

  private handleChatMessageUpdate(message: ConversationMessage): void {
    if (!this.view) return;

    const chatMessage: ChatMessageModel = {
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: new Date(message.timestamp).toISOString(),
    };

    this.view.showAIResponse(chatMessage);
  }

  private handleStreamChunk(chunk: string): void {
    if (!this.view) return;
  }

  private handleChatError(error: Error): void {
    if (!this.view) return;

    const errorMessage: ChatMessageModel = {
      id: `error_${Date.now()}`,
      role: 'assistant',
      content: `抱歉，AI服务暂时不可用：${error.message}`,
      timestamp: new Date().toISOString(),
    };

    this.view.showAIResponse(errorMessage);
  }

  onViewInitialized(view: IMusicView): void {
    this.view = view;
    this.loadUserPreferences();
    this.notifyViewTheme();
  }

  private loadUserPreferences(): void {
    try {
      const saved = localStorage.getItem('musicagent_settings');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<AppSettings>;
        this.settings = { ...this.settings, ...parsed };
      }
    } catch {
      // ignore
    }
  }

  private saveUserPreferences(): void {
    try {
      localStorage.setItem('musicagent_settings', JSON.stringify(this.settings));
    } catch {
      // ignore
    }
  }

  private notifyViewTheme(): void {
    if (!this.view) return;
    const isDark =
      this.settings.theme === 'dark' ||
      (this.settings.theme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    document.documentElement.classList.toggle('dark', isDark);
  }

  async handleUserPrompt(prompt: string): Promise<void> {
    if (!this.view) return;

    const userMessage: ChatMessageModel = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    };

    this.view.showAIResponse(userMessage);

    if (this.aiChatService) {
      await this.aiChatService.sendMessage(prompt);
      return;
    }

    const result = this.recommendationEngine.recommendByPrompt(prompt, 10);

    if (result.tracks.length > 0) {
      this.currentPlaylist = result.tracks;
      this.currentPlaylistIndex = 0;
    }

    const aiMessage = this.recommendationEngine.toChatMessage(result, prompt);
    this.view.showAIResponse(aiMessage);

    if (result.tracks.length > 0) {
      const topTrack = result.tracks[0];
      this.view.renderTrackMetadata(topTrack.title, topTrack.artist, topTrack.coverUrl);
    }
  }

  onMoodCardClicked(moodType: string): void {
    if (!this.view) return;

    const result = this.recommendationEngine.recommendByMood(moodType, 20);

    if (result.tracks.length > 0) {
      this.currentPlaylist = result.tracks;
      this.currentPlaylistIndex = 0;

      const firstTrack = result.tracks[0];
      this.playTrack(firstTrack);

      const aiMessage: ChatMessageModel = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `为您生成「${moodType}」电台，共 ${result.tracks.length} 首精选曲目。${result.explanation}`,
        timestamp: new Date().toISOString(),
      };
      this.view.showAIResponse(aiMessage);
    }
  }

  onPlayPauseClicked(): void {
    if (this.playbackState.isPlaying) {
      this.pausePlayback();
    } else {
      this.startPlayback();
    }
  }

  onPlayNextRequested(): void {
    if (this.currentPlaylist.length === 0) return;

    let nextIndex: number;

    switch (this.playbackState.playbackStrategy) {
      case 'shuffle':
        nextIndex = Math.floor(Math.random() * this.currentPlaylist.length);
        break;
      case 'repeat':
        nextIndex = this.currentPlaylistIndex;
        break;
      case 'normal':
      default:
        nextIndex = (this.currentPlaylistIndex + 1) % this.currentPlaylist.length;
        break;
    }

    this.currentPlaylistIndex = nextIndex;
    const nextTrack = this.currentPlaylist[nextIndex];
    this.playTrack(nextTrack);
  }

  onPlayPreviousRequested(): void {
    if (this.currentPlaylist.length === 0) return;

    const prevIndex =
      this.currentPlaylistIndex === 0
        ? this.currentPlaylist.length - 1
        : this.currentPlaylistIndex - 1;

    this.currentPlaylistIndex = prevIndex;
    const prevTrack = this.currentPlaylist[prevIndex];
    this.playTrack(prevTrack);
  }

  onSeekRequested(percent: number): void {
    this.playbackState.currentMs = Math.floor(
      (percent / 100) * this.playbackState.totalMs
    );
    this.notifyTimelineUpdate();
  }

  onVolumeChanged(volume: number): void {
    this.playbackState.volume = volume;
  }

  onTrackLiked(trackId: string, liked: boolean): void {
    const feedback: UserFeedback = {
      trackId,
      liked,
      skipped: false,
      playCount: 1,
      totalPlayTimeMs: this.playbackState.currentMs,
    };
    this.recommendationEngine.recordFeedback(feedback);
  }

  onTrackSkipped(trackId: string): void {
    const feedback: UserFeedback = {
      trackId,
      liked: false,
      skipped: true,
      playCount: 1,
      totalPlayTimeMs: this.playbackState.currentMs,
    };
    this.recommendationEngine.recordFeedback(feedback);
    this.onPlayNextRequested();
  }

  onSettingsChanged(settingKey: keyof AppSettings, value: unknown): void {
    (this.settings as Record<string, unknown>)[settingKey] = value;
    this.saveUserPreferences();

    if (settingKey === 'theme') {
      this.notifyViewTheme();
    }
  }

  setPlaybackStrategy(strategy: PlaybackState['playbackStrategy']): void {
    this.playbackState.playbackStrategy = strategy;
  }

  loadTrackPool(tracks: TrackFeatures[]): void {
    this.recommendationEngine.setTrackPool(tracks);
  }

  getColdStartRecommendations(preferredGenres: string[]): void {
    if (!this.view) return;

    const result = this.recommendationEngine.getColdStartRecommendations(preferredGenres, 20);

    if (result.tracks.length > 0) {
      this.currentPlaylist = result.tracks;
      this.currentPlaylistIndex = 0;

      const aiMessage: ChatMessageModel = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `欢迎！根据您选择的偏好，为您准备了 ${result.tracks.length} 首入门推荐。${result.explanation}`,
        timestamp: new Date().toISOString(),
      };
      this.view.showAIResponse(aiMessage);
    }
  }

  renderVisualization(metrics: AnalyticsPayload): void {
    this.view?.renderVisualizationDashboard(metrics);
  }

  updateServiceStatus(platform: string, isBound: boolean, username: string): void {
    this.view?.updateServiceBindingStatus(platform, isBound, username);
  }

  private playTrack(track: TrackFeatures): void {
    this.playbackState.currentTrackId = track.trackId;
    this.playbackState.currentMs = 0;
    this.playbackState.isPlaying = true;

    this.view?.renderTrackMetadata(track.title, track.artist, track.coverUrl);
    this.startProgressTimer();
    this.notifyTimelineUpdate();
  }

  private startPlayback(): void {
    if (!this.playbackState.currentTrackId && this.currentPlaylist.length > 0) {
      this.playTrack(this.currentPlaylist[0]);
      return;
    }

    this.playbackState.isPlaying = true;
    this.startProgressTimer();
    this.notifyTimelineUpdate();
  }

  private pausePlayback(): void {
    this.playbackState.isPlaying = false;
    this.stopProgressTimer();
    this.notifyTimelineUpdate();
  }

  private startProgressTimer(): void {
    this.stopProgressTimer();
    this.progressTimer = setInterval(() => {
      this.playbackState.currentMs += 1000;
      if (this.playbackState.currentMs >= this.playbackState.totalMs) {
        this.onPlayNextRequested();
        return;
      }
      this.notifyTimelineUpdate();
    }, 1000);
  }

  private stopProgressTimer(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  private notifyTimelineUpdate(): void {
    this.view?.updatePlaybackTimeline(
      this.playbackState.currentMs,
      this.playbackState.totalMs
    );
  }

  dispose(): void {
    this.stopProgressTimer();
    this.view = null;
  }
}

export const musicPresenter = new MusicPresenter();
