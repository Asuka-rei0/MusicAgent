import { Cloud, Sun, Moon, Coffee, Heart, Zap } from 'lucide-react';
import { motion } from 'motion/react';

const topCharts = [
  {
    platform: 'Spotify',
    color: 'from-green-500 to-emerald-600',
    tracks: ['Blinding Lights', 'Save Your Tears', 'Levitating'],
  },
  {
    platform: 'NetEase Cloud',
    color: 'from-red-500 to-rose-600',
    tracks: ['晴天', '七里香', '稻香'],
  },
  {
    platform: 'Apple Music',
    color: 'from-pink-500 to-rose-600',
    tracks: ['As It Was', 'Anti-Hero', 'Flowers'],
  },
  {
    platform: 'YouTube Music',
    color: 'from-red-600 to-orange-600',
    tracks: ['Heat Waves', 'Shivers', 'Stay'],
  },
];

const moods = [
  { name: 'Focus', icon: Zap, gradient: 'from-blue-500 to-cyan-500' },
  { name: 'Rainy Day', icon: Cloud, gradient: 'from-gray-500 to-blue-500' },
  { name: 'Jazz Night', icon: Moon, gradient: 'from-indigo-500 to-purple-500' },
  { name: 'Morning Coffee', icon: Coffee, gradient: 'from-amber-500 to-orange-500' },
  { name: 'Chill Vibes', icon: Heart, gradient: 'from-pink-500 to-rose-500' },
  { name: 'Energize', icon: Sun, gradient: 'from-yellow-500 to-orange-500' },
];

export default function ExploreView() {
  return (
    <div className="h-full overflow-auto text-white">
      <div className="p-6 space-y-8">
        {/* AI Discovery Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative h-64 rounded-2xl overflow-hidden"
        >
          <img
            src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=400&fit=crop"
            alt="AI Discovery"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent flex items-center">
            <div className="p-12">
              <h2 className="text-4xl font-bold mb-3">AI 发现：今日心情电台</h2>
              <p className="text-lg text-gray-300 mb-6">基于您的收听习惯，精选适合今日心情的音乐</p>
              <button className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all font-medium">
                开始收听
              </button>
            </div>
          </div>
        </motion.div>

        {/* Top Charts */}
        <div>
          <h3 className="text-2xl font-bold mb-6">Top Charts</h3>
          <div className="grid grid-cols-4 gap-4">
            {topCharts.map((chart, index) => (
              <motion.div
                key={chart.platform}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#12121a]/80 backdrop-blur-xl rounded-xl border border-white/10 p-6 hover:border-purple-500/30 transition-all cursor-pointer group"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${chart.color} mb-4 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <span className="text-2xl font-bold">#1</span>
                </div>
                <h4 className="font-semibold mb-3">{chart.platform}</h4>
                <div className="space-y-2">
                  {chart.tracks.map((track, idx) => (
                    <div key={idx} className="text-sm text-gray-400 truncate">
                      {idx + 1}. {track}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Browse by Mood */}
        <div>
          <h3 className="text-2xl font-bold mb-6">Browse by Mood</h3>
          <div className="grid grid-cols-3 gap-4">
            {moods.map((mood, index) => {
              const Icon = mood.icon;
              return (
                <motion.button
                  key={mood.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`h-32 rounded-xl bg-gradient-to-br ${mood.gradient} p-6 flex flex-col justify-between items-start text-left relative overflow-hidden group`}
                >
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                  <Icon className="w-8 h-8 relative z-10" />
                  <h4 className="text-lg font-semibold relative z-10">{mood.name}</h4>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Recently Played */}
        <div>
          <h3 className="text-2xl font-bold mb-6">Recently Played</h3>
          <div className="grid grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: item * 0.05 }}
                className="cursor-pointer group"
              >
                <div className="aspect-square rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 mb-3 overflow-hidden">
                  <img
                    src={`https://images.unsplash.com/photo-${1514525253193 + item * 1000000}-c46ffb0e5ad?w=300&h=300&fit=crop`}
                    alt={`Album ${item}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <h5 className="font-medium text-sm truncate">Album Title</h5>
                <p className="text-xs text-gray-400 truncate">Artist Name</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
