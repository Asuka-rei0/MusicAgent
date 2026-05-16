import { createContext, useContext, useMemo, useState, ReactNode, useEffect } from 'react';
import {
  PlaybackStatus,
  PlayCommandType,
  WebAudioService,
  type AudioState,
} from '@music-agent/a-audio-core';
import { demoTracks, type DemoTrack } from '../data/demoTracks';

interface PlayerContextType {
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  progress: number;
  setProgress: (progress: number) => void;
  volume: number;
  setVolume: (volume: number) => void;
  currentTime: number;
  duration: number;
  currentTrack: DemoTrack | null;
  playTrack: (trackId: string) => void;
  playNext: () => void;
  playPrevious: () => void;
  audioState: AudioState;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [audioService] = useState(() => new WebAudioService());
  const [audioState, setAudioState] = useState<AudioState>(() => audioService.getState());

  useEffect(() => {
    const observer = {
      onAudioStateChanged: setAudioState,
    };

    audioService.attachObserver(observer);
    audioService.executeCommand({
      type: PlayCommandType.SetQueue,
      queue: demoTracks,
      startIndex: 0,
    });

    return () => {
      audioService.detachObserver(observer);
      audioService.dispose();
    };
  }, [audioService]);

  const currentTrack = useMemo(
    () => demoTracks.find((track) => track.id === audioState.trackId) ?? demoTracks[0] ?? null,
    [audioState.trackId],
  );

  const durationMs = audioState.durationMs || currentTrack?.durationMs || 0;
  const currentTime = audioState.currentMs / 1000;
  const duration = durationMs / 1000;
  const progress = durationMs > 0 ? (audioState.currentMs / durationMs) * 100 : 0;
  const volume = Math.round(audioState.volume * 100);
  const isPlaying = audioState.status === PlaybackStatus.Playing || audioState.status === PlaybackStatus.Buffering;

  const setIsPlaying = (playing: boolean) => {
    audioService.executeCommand({
      type: playing ? PlayCommandType.Play : PlayCommandType.Pause,
    });
  };

  const setProgress = (nextProgress: number) => {
    audioService.seekToPosition((Math.max(0, Math.min(100, nextProgress)) / 100) * durationMs);
  };

  const setVolume = (nextVolume: number) => {
    audioService.executeCommand({
      type: PlayCommandType.SetVolume,
      volume: Math.max(0, Math.min(100, nextVolume)) / 100,
    });
  };

  const playTrack = (trackId: string) => {
    const track = demoTracks.find((item) => item.id === trackId);
    if (!track) return;

    audioService.loadMedia(track.id, track.sourceUri);
    audioService.executeCommand({ type: PlayCommandType.Play });
  };

  const playNext = () => {
    audioService.executeCommand({ type: PlayCommandType.Next });
  };

  const playPrevious = () => {
    audioService.executeCommand({ type: PlayCommandType.Previous });
  };

  return (
    <PlayerContext.Provider
      value={{
        isPlaying,
        setIsPlaying,
        progress,
        setProgress,
        volume,
        setVolume,
        currentTime,
        duration,
        currentTrack,
        playTrack,
        playNext,
        playPrevious,
        audioState,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return context;
}
