import { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Heart, Sparkles } from 'lucide-react';
import Slider from '@mui/material/Slider';

export default function MediaPlayerBar() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(35);
  const [volume, setVolume] = useState(70);
  const [isLiked, setIsLiked] = useState(false);

  return (
    <div className="h-24 bg-gradient-to-r from-[#1a1a2e]/95 to-[#12121a]/95 border-t border-white/10 backdrop-blur-2xl px-6 flex items-center gap-6 text-white">
      {/* Current Track Info */}
      <div className="flex items-center gap-4 w-80">
        <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=200&h=200&fit=crop"
            alt="Album"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">Midnight Jazz</div>
          <div className="text-sm text-gray-400 truncate">Smooth Jazz Ensemble</div>
        </div>
        <button
          onClick={() => setIsLiked(!isLiked)}
          className="p-2 hover:bg-white/5 rounded-full transition-colors"
        >
          <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
        </button>
      </div>

      {/* Playback Controls */}
      <div className="flex-1 flex flex-col items-center gap-2">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white">
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full hover:from-purple-600 hover:to-pink-700 transition-all transform hover:scale-105"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-white" />
            ) : (
              <Play className="w-6 h-6 fill-white" />
            )}
          </button>

          <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white">
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-2xl flex items-center gap-3">
          <span className="text-xs text-gray-400 w-10 text-right">2:15</span>
          <Slider
            value={progress}
            onChange={(_, value) => setProgress(value as number)}
            sx={{
              color: '#a855f7',
              height: 4,
              '& .MuiSlider-thumb': {
                width: 12,
                height: 12,
                '&:hover, &.Mui-focusVisible': {
                  boxShadow: '0 0 0 8px rgba(168, 85, 247, 0.16)',
                },
              },
            }}
          />
          <span className="text-xs text-gray-400 w-10">6:30</span>
        </div>
      </div>

      {/* Volume & Actions */}
      <div className="flex items-center gap-4 w-80 justify-end">
        <button className="p-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full hover:from-purple-500/30 hover:to-pink-500/30 transition-colors border border-purple-500/30">
          <Sparkles className="w-5 h-5 text-purple-400" />
        </button>

        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-gray-400" />
          <Slider
            value={volume}
            onChange={(_, value) => setVolume(value as number)}
            className="w-24"
            sx={{
              color: '#9ca3af',
              height: 4,
              '& .MuiSlider-thumb': {
                width: 10,
                height: 10,
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
