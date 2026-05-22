import type { PlaybackTrack } from '@music-agent/a-audio-core';

export interface DemoTrack extends PlaybackTrack {
  album: string;
  cover: string;
  durationLabel: string;
}

export const demoTracks: DemoTrack[] = [
  {
    id: 'midnight-jazz',
    title: 'Midnight Jazz',
    artist: 'Smooth Jazz Ensemble',
    album: 'Late Night Sessions',
    durationMs: 390000,
    durationLabel: '6:30',
    sourceUri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    cover: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=200&h=200&fit=crop',
  },
  {
    id: 'blue-notes',
    title: 'Blue Notes',
    artist: 'Jazz Trio',
    album: 'Classic Jazz Vol. 2',
    durationMs: 345000,
    durationLabel: '5:45',
    sourceUri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop',
  },
  {
    id: 'autumn-leaves',
    title: 'Autumn Leaves',
    artist: 'Piano Masters',
    album: 'Season Collection',
    durationMs: 260000,
    durationLabel: '4:20',
    sourceUri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
  },
  {
    id: 'sax-in-the-city',
    title: 'Sax in the City',
    artist: 'Urban Jazz Band',
    album: 'City Lights',
    durationMs: 435000,
    durationLabel: '7:15',
    sourceUri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    cover: 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=200&h=200&fit=crop',
  },
  {
    id: 'smooth-groove',
    title: 'Smooth Groove',
    artist: 'The Jazz Players',
    album: 'Essential Jazz',
    durationMs: 330000,
    durationLabel: '5:30',
    sourceUri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    cover: 'https://images.unsplash.com/photo-1514525253193-7a097e3d9b0f?w=200&h=200&fit=crop',
  },
];
