import { useState } from 'react';
import { Switch, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { FolderPlus, Trash2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface LocalPath {
  id: string;
  path: string;
  trackCount: number;
}

export default function SettingsView() {
  const [theme, setTheme] = useState('dark');
  const [desktopLyrics, setDesktopLyrics] = useState(false);
  const [colorFollowAlbum, setColorFollowAlbum] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  const [localPaths, setLocalPaths] = useState<LocalPath[]>([
    { id: '1', path: 'C:\\Users\\Music', trackCount: 1245 },
    { id: '2', path: 'D:\\Downloads\\Music', trackCount: 367 },
  ]);

  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [neteaseConnected, setNeteaseConnected] = useState(true);

  const handleAddPath = () => {
    const newPath: LocalPath = {
      id: Date.now().toString(),
      path: 'C:\\Users\\NewFolder',
      trackCount: 0,
    };
    setLocalPaths([...localPaths, newPath]);
  };

  const handleRemovePath = (id: string) => {
    setLocalPaths(localPaths.filter((path) => path.id !== id));
  };

  return (
    <div className="h-full overflow-auto text-white">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        {/* Theme & Appearance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h2 className="text-xl font-semibold mb-6">应用主题与外观</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm text-gray-400 mb-3">主题模式</label>
              <ToggleButtonGroup
                value={theme}
                exclusive
                onChange={(_, value) => value && setTheme(value)}
                sx={{
                  '& .MuiToggleButton-root': {
                    color: '#9ca3af',
                    borderColor: 'rgba(255,255,255,0.1)',
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(168, 85, 247, 0.2)',
                      color: '#a855f7',
                      borderColor: '#a855f7',
                      '&:hover': {
                        backgroundColor: 'rgba(168, 85, 247, 0.3)',
                      },
                    },
                  },
                }}
              >
                <ToggleButton value="light">亮色</ToggleButton>
                <ToggleButton value="dark">暗色</ToggleButton>
                <ToggleButton value="system">跟随系统</ToggleButton>
              </ToggleButtonGroup>
            </div>

            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">自动播放</div>
                  <div className="text-sm text-gray-400">启动时自动播放上次歌曲</div>
                </div>
                <Switch
                  checked={autoPlay}
                  onChange={(e) => setAutoPlay(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#a855f7',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#a855f7',
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Lyrics Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h2 className="text-xl font-semibold mb-6">歌词显示</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">桌面歌词浮窗</div>
                <div className="text-sm text-gray-400">在桌面显示独立的歌词窗口</div>
              </div>
              <Switch
                checked={desktopLyrics}
                onChange={(e) => setDesktopLyrics(e.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#a855f7',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#a855f7',
                  },
                }}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <div>
                <div className="font-medium">歌词颜色跟随专辑</div>
                <div className="text-sm text-gray-400">根据专辑封面自动调整歌词颜色</div>
              </div>
              <Switch
                checked={colorFollowAlbum}
                onChange={(e) => setColorFollowAlbum(e.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#a855f7',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#a855f7',
                  },
                }}
              />
            </div>
          </div>
        </motion.div>

        {/* Local Library */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">曲库与存储</h2>
            <button
              onClick={handleAddPath}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg border border-purple-500/30 transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              添加路径
            </button>
          </div>

          <div className="space-y-3 mb-6">
            {localPaths.map((path) => (
              <div
                key={path.id}
                className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{path.path}</div>
                  <div className="text-sm text-gray-400">{path.trackCount} 首歌曲</div>
                </div>
                <button
                  onClick={() => handleRemovePath(path.id)}
                  className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors">
            <RefreshCw className="w-4 h-4" />
            立即重新扫描
          </button>
        </motion.div>

        {/* Service Bindings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h2 className="text-xl font-semibold mb-6">服务绑定状态</h2>

          <div className="space-y-4">
            {/* Spotify */}
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <span className="text-xl font-bold">S</span>
                </div>
                <div>
                  <div className="font-medium">Spotify</div>
                  <div className="text-sm text-gray-400 flex items-center gap-2">
                    {spotifyConnected ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        已连接
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-gray-500" />
                        未连接
                      </>
                    )}
                  </div>
                </div>
              </div>
              {spotifyConnected ? (
                <button
                  onClick={() => setSpotifyConnected(false)}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg border border-red-500/30 transition-colors text-red-400"
                >
                  解除绑定
                </button>
              ) : (
                <button
                  onClick={() => setSpotifyConnected(true)}
                  className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg border border-green-500/30 transition-colors text-green-400"
                >
                  立即绑定
                </button>
              )}
            </div>

            {/* NetEase Cloud Music */}
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                  <span className="text-xl font-bold">网</span>
                </div>
                <div>
                  <div className="font-medium">网易云音乐</div>
                  <div className="text-sm text-gray-400 flex items-center gap-2">
                    {neteaseConnected ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        已登录 (user@example.com)
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-gray-500" />
                        未登录
                      </>
                    )}
                  </div>
                </div>
              </div>
              {neteaseConnected ? (
                <button
                  onClick={() => setNeteaseConnected(false)}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg border border-red-500/30 transition-colors text-red-400"
                >
                  注销
                </button>
              ) : (
                <button
                  onClick={() => setNeteaseConnected(true)}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg border border-red-500/30 transition-colors text-red-400"
                >
                  登录
                </button>
              )}
            </div>
          </div>
        </motion.div>

        <div className="h-24" />
      </div>
    </div>
  );
}
