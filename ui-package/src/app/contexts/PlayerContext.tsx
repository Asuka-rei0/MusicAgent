import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface PlayerContextType {
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  progress: number;
  setProgress: (progress: number) => void;
  volume: number;
  setVolume: (volume: number) => void;
  currentTime: number;
  duration: number;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(35);
  const [volume, setVolume] = useState(70);
  const duration = 390; // 6:30 in seconds

  // Calculate current time based on progress (0-100)
  const currentTime = (progress / 100) * duration;

  // Auto-increment progress when playing
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (100 / duration); // Increment by 1 second worth of progress
        return next >= 100 ? 100 : next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, duration]);

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
