import { useState } from 'react';
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Play, Heart, MoreVertical } from 'lucide-react';
import { motion } from 'motion/react';

const weeklyData = [
  { day: 'Mon', hours: 3.2 },
  { day: 'Tue', hours: 4.1 },
  { day: 'Wed', hours: 2.8 },
  { day: 'Thu', hours: 5.2 },
  { day: 'Fri', hours: 6.8 },
  { day: 'Sat', hours: 8.5 },
  { day: 'Sun', hours: 7.2 },
];

const platformData = [
  { name: 'Spotify', value: 18, color: '#1DB954' },
  { name: 'NetEase', value: 12, color: '#D33A31' },
  { name: 'Apple Music', value: 8, color: '#FA243C' },
  { name: 'YouTube', value: 4, color: '#FF0000' },
];

const playlists = [
  { id: 1, name: 'Jazz Favorites', tracks: 45, duration: '3h 12m', cover: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=200&h=200&fit=crop' },
  { id: 2, name: 'Morning Vibes', tracks: 32, duration: '2h 45m', cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop' },
  { id: 3, name: 'Workout Mix', tracks: 58, duration: '4h 20m', cover: 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=200&h=200&fit=crop' },
  { id: 4, name: 'Chill Beats', tracks: 67, duration: '5h 05m', cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop' },
  { id: 5, name: 'Classic Hits', tracks: 89, duration: '6h 30m', cover: 'https://images.unsplash.com/photo-1514525253193-7a097e3d9b0f?w=200&h=200&fit=crop' },
];

const tracks = [
  { id: 1, title: 'Midnight Jazz', artist: 'Smooth Jazz Ensemble', album: 'Late Night Sessions', duration: '6:30' },
  { id: 2, title: 'Blue Notes', artist: 'Jazz Trio', album: 'Classic Jazz Vol. 2', duration: '5:45' },
  { id: 3, title: 'Autumn Leaves', artist: 'Piano Masters', album: 'Season Collection', duration: '4:20' },
  { id: 4, title: 'Sax in the City', artist: 'Urban Jazz Band', album: 'City Lights', duration: '7:15' },
  { id: 5, title: 'Smooth Groove', artist: 'The Jazz Players', album: 'Essential Jazz', duration: '5:30' },
];

export default function MusicLibraryView() {
  const [selectedPlaylist, setSelectedPlaylist] = useState(playlists[0]);
  const totalHours = platformData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="h-full overflow-auto text-white">
      <div className="p-6 space-y-6">
        {/* Statistics */}
        <div className="grid grid-cols-2 gap-6">
          {/* Weekly Report */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
          >
            <h3 className="text-xl font-semibold mb-6">Weekly Report</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a2e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                />
                <Area type="monotone" dataKey="hours" stroke="#a855f7" fillOpacity={1} fill="url(#colorHours)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-4 text-sm text-gray-400">
              Total: <span className="text-white font-semibold">37.8 hours</span> this week
            </div>
          </motion.div>

          {/* Listening Time by Platform */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
          >
            <h3 className="text-xl font-semibold mb-6">Listening Time</h3>
            <div className="flex items-center justify-between">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {platformData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="flex-1 space-y-3">
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold">{totalHours} Hours</div>
                  <div className="text-sm text-gray-400">This month</div>
                </div>
                {platformData.map((platform) => (
                  <div key={platform.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: platform.color }} />
                      <span>{platform.name}</span>
                    </div>
                    <span className="text-gray-400">{platform.value}h</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Playlists */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-xl font-semibold mb-6">My Playlists</h3>
          <div className="grid grid-cols-5 gap-4">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                onClick={() => setSelectedPlaylist(playlist)}
                className={`cursor-pointer rounded-lg p-3 transition-all ${
                  selectedPlaylist.id === playlist.id
                    ? 'bg-purple-500/20 border border-purple-500/50'
                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                }`}
              >
                <div className="aspect-square rounded-lg overflow-hidden mb-3">
                  <img src={playlist.cover} alt={playlist.name} className="w-full h-full object-cover" />
                </div>
                <h4 className="font-medium text-sm truncate">{playlist.name}</h4>
                <p className="text-xs text-gray-400">{playlist.tracks} tracks • {playlist.duration}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Track List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-xl font-semibold mb-6">{selectedPlaylist.name}</h3>
          <div className="space-y-2">
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors group cursor-pointer"
              >
                <div className="w-8 text-gray-400 text-sm">{index + 1}</div>
                <button className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-4 h-4 fill-white" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{track.title}</div>
                  <div className="text-sm text-gray-400 truncate">{track.artist}</div>
                </div>
                <div className="text-sm text-gray-400">{track.album}</div>
                <div className="text-sm text-gray-400 w-16 text-right">{track.duration}</div>
                <button className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Heart className="w-4 h-4" />
                </button>
                <button className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
