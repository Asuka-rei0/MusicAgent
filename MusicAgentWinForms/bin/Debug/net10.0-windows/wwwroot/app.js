const App = (() => {
    let currentView = 'ai-recommend';
    let isPlaying = false;
    let progress = 35;
    let volume = 70;
    let currentTime = 0;
    let duration = 390;
    let isLiked = false;
    let messages = [
        { id: '1', type: 'user', content: 'Feeling tired, need something soothing...', timestamp: new Date(Date.now() - 120000) },
        { id: '2', type: 'ai', content: '为您推荐这首爵士乐，慢节奏的钢琴与萨克斯风完美融合，非常适合放松心情。', timestamp: new Date(Date.now() - 60000) }
    ];
    let playlists = [];
    let tracks = [];
    let weeklyData = [];
    let platformData = [];
    let localPaths = [];
    let settings = { theme: 'dark', autoPlay: true, desktopLyrics: false, colorFollowAlbum: true };
    let selectedPlaylist = null;
    let lyrics = [
        { text: 'In the beginning there was silence', time: 0 },
        { text: 'Then came the sound of distant notes', time: 20 },
        { text: 'Piano keys dancing in the dark', time: 40 },
        { text: 'Under the moonlight so serene', time: 60 },
        { text: 'The gentle keys are playing...', time: 80 },
        { text: 'Melodies float through the air', time: 100 },
        { text: 'Saxophone whispers through the night', time: 120 },
        { text: 'A melody so enchanting', time: 140 },
        { text: 'Hearts begin to sway and move', time: 160 },
        { text: 'Stars are dancing in the sky', time: 180 },
        { text: 'Jazz fills the midnight hour', time: 200 },
        { text: 'Smooth rhythms carry us away', time: 220 },
        { text: 'In this moment we are free', time: 240 },
        { text: 'Lost in the music forever', time: 260 },
        { text: 'Until the dawn breaks again', time: 280 }
    ];

    const navItems = [
        { path: 'ai-recommend', label: 'AI Recommend', icon: 'sparkles' },
        { path: 'explore', label: 'Explore', icon: 'compass' },
        { path: 'library', label: 'Music Library', icon: 'library' },
        { path: 'settings', label: 'Settings', icon: 'settings' }
    ];

    function init() {
        window.addEventListener('message', handleWebMessage);
        loadInitialData();
        render();
        startProgressTimer();
    }

    function handleWebMessage(event) {
        const response = JSON.parse(event.data);
        console.log('Received from C#:', response);
        
        switch (response.action) {
            case 'getPlaylists':
                playlists = JSON.parse(response.data);
                if (playlists.length > 0 && !selectedPlaylist) selectedPlaylist = playlists[0];
                render();
                break;
            case 'getTracks':
                tracks = JSON.parse(response.data);
                render();
                break;
            case 'getWeeklyData':
                weeklyData = JSON.parse(response.data);
                render();
                break;
            case 'getPlatformData':
                platformData = JSON.parse(response.data);
                render();
                break;
            case 'getLocalPaths':
                localPaths = JSON.parse(response.data);
                render();
                break;
            case 'getSettings':
                settings = JSON.parse(response.data);
                render();
                break;
            case 'getProgress':
                const progressData = JSON.parse(response.data);
                progress = progressData.progress;
                currentTime = progressData.currentTime;
                isPlaying = progressData.isPlaying;
                renderPlayer();
                break;
        }
    }

    function sendToCSharp(action, data = '') {
        const message = { id: Date.now().toString(), action, data };
        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.postMessage(JSON.stringify(message));
        } else {
            console.log('Mock message to C#:', message);
        }
    }

    function loadInitialData() {
        sendToCSharp('getPlaylists');
        sendToCSharp('getWeeklyData');
        sendToCSharp('getPlatformData');
        sendToCSharp('getLocalPaths');
        sendToCSharp('getSettings');
    }

    function startProgressTimer() {
        setInterval(() => {
            if (isPlaying) {
                currentTime += 1;
                progress = (currentTime / duration) * 100;
                if (progress >= 100) {
                    progress = 100;
                    isPlaying = false;
                }
                renderPlayer();
            }
        }, 1000);
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function getActiveLyricIndex() {
        return lyrics.findIndex((lyric, index) => {
            const nextLyric = lyrics[index + 1];
            return currentTime >= lyric.time && (!nextLyric || currentTime < nextLyric.time);
        });
    }

    function render() {
        const app = document.getElementById('app');
        app.innerHTML = `
            ${renderSidebar()}
            <div class="content-area">
                <div class="main-content" id="main-content">
                    ${renderView()}
                </div>
                ${renderPlayerBar()}
            </div>
        `;
        attachEventListeners();
    }

    function renderSidebar() {
        return `
            <div class="sidebar flex flex-col text-white">
                <div class="p-6">
                    <h1 class="text-2xl font-bold gradient-text">Music Player</h1>
                </div>
                <nav class="flex-1 px-3 space-y-1">
                    ${navItems.map(item => `
                        <div class="nav-item ${currentView === item.path ? 'active' : ''}" data-path="${item.path}">
                            ${renderIcon(item.icon)}
                            <span>${item.label}</span>
                        </div>
                    `).join('')}
                </nav>
                <div class="p-4 border-t border-white/10">
                    <div class="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                            <span class="text-sm font-bold">U</span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium truncate">User</div>
                            <div class="text-xs text-gray-400">Premium</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderIcon(name) {
        const icons = {
            sparkles: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>',
            compass: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>',
            library: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>',
            settings: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>'
        };
        return icons[name] || '';
    }

    function renderView() {
        switch (currentView) {
            case 'ai-recommend': return renderAIRecommend();
            case 'explore': return renderExplore();
            case 'library': return renderLibrary();
            case 'settings': return renderSettings();
            default: return renderAIRecommend();
        }
    }

    function renderAIRecommend() {
        const activeLyricIndex = getActiveLyricIndex();
        return `
            <div class="h-full flex gap-6 overflow-hidden">
                <div class="flex-1 flex flex-col gap-6">
                    <div class="card flex-1 overflow-auto">
                        <h2 class="text-xl font-semibold mb-6 flex items-center gap-2">
                            <svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                            AI Music Assistant
                        </h2>
                        <div class="space-y-4 mb-6" id="chat-messages">
                            ${messages.map(msg => `
                                <div class="flex gap-3 ${msg.type === 'user' ? 'justify-end' : ''}">
                                    ${msg.type === 'ai' ? `<div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg></div>` : ''}
                                    <div class="message-bubble ${msg.type === 'user' ? 'message-user' : 'message-ai'}">
                                        <p class="text-sm leading-relaxed">${msg.content}</p>
                                        <p class="text-xs text-gray-500 mt-2">${msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    ${msg.type === 'user' ? `<div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg></div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                        <div class="flex gap-3">
                            <input type="text" id="chat-input" placeholder="Tell me your mood or music preference..." 
                                class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/50 transition-colors text-white">
                            <button id="send-btn" class="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                                Send
                            </button>
                        </div>
                    </div>
                    <div class="h-64 card flex items-center gap-6">
                        <div class="w-44 h-44 rounded-xl overflow-hidden shadow-2xl">
                            <img src="https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop" alt="Midnight Jazz" class="w-full h-full object-cover">
                        </div>
                        <div class="flex-1">
                            <h3 class="text-2xl font-bold mb-2">Midnight Jazz</h3>
                            <p class="text-gray-400 mb-4">Smooth Jazz Ensemble</p>
                            <div class="flex gap-2 text-sm text-gray-500">
                                <span>2024</span><span>•</span><span>12 tracks</span><span>•</span><span>Jazz</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="w-96 card flex flex-col">
                    <h3 class="text-lg font-semibold mb-6">Lyrics</h3>
                    <div class="flex-1 overflow-auto" style="scrollbar-width: none;">
                        <div class="flex flex-col items-center gap-6 py-16">
                            ${lyrics.map((lyric, index) => `
                                <div class="lyric-line ${index === activeLyricIndex ? 'lyric-active' : 'lyric-inactive'}">${lyric.text}</div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="mt-6 pt-6 border-t border-white/10 text-sm text-gray-500 text-center">
                        Playing from <span class="text-purple-400">AI Recommendations</span>
                    </div>
                </div>
            </div>
        `;
    }

    function renderExplore() {
        const moods = [
            { name: 'Focus', gradient: 'from-blue-500 to-cyan-500' },
            { name: 'Rainy Day', gradient: 'from-gray-500 to-blue-500' },
            { name: 'Jazz Night', gradient: 'from-indigo-500 to-purple-500' },
            { name: 'Morning Coffee', gradient: 'from-amber-500 to-orange-500' },
            { name: 'Chill Vibes', gradient: 'from-pink-500 to-rose-500' },
            { name: 'Energize', gradient: 'from-yellow-500 to-orange-500' }
        ];
        const charts = [
            { platform: 'Spotify', color: 'from-green-500 to-emerald-600', tracks: ['Blinding Lights', 'Save Your Tears', 'Levitating'] },
            { platform: 'NetEase Cloud', color: 'from-red-500 to-rose-600', tracks: ['晴天', '七里香', '稻香'] },
            { platform: 'Apple Music', color: 'from-pink-500 to-rose-600', tracks: ['As It Was', 'Anti-Hero', 'Flowers'] },
            { platform: 'YouTube Music', color: 'from-red-600 to-orange-600', tracks: ['Heat Waves', 'Shivers', 'Stay'] }
        ];
        return `
            <div class="space-y-8">
                <div class="relative h-64 rounded-2xl overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=400&fit=crop" alt="AI Discovery" class="w-full h-full object-cover">
                    <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent flex items-center">
                        <div class="p-12">
                            <h2 class="text-4xl font-bold mb-3">AI 发现：今日心情电台</h2>
                            <p class="text-lg text-gray-300 mb-6">基于您的收听习惯，精选适合今日心情的音乐</p>
                            <button class="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all font-medium">开始收听</button>
                        </div>
                    </div>
                </div>
                <div>
                    <h3 class="text-2xl font-bold mb-6">Top Charts</h3>
                    <div class="grid grid-cols-4 gap-4">
                        ${charts.map(chart => `
                            <div class="card hover:border-purple-500/30 transition-all cursor-pointer group">
                                <div class="w-12 h-12 rounded-lg bg-gradient-to-br ${chart.color} mb-4 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <span class="text-2xl font-bold">#1</span>
                                </div>
                                <h4 class="font-semibold mb-3">${chart.platform}</h4>
                                <div class="space-y-2">
                                    ${chart.tracks.map((track, idx) => `<div class="text-sm text-gray-400 truncate">${idx + 1}. ${track}</div>`).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div>
                    <h3 class="text-2xl font-bold mb-6">Browse by Mood</h3>
                    <div class="grid grid-cols-3 gap-4">
                        ${moods.map(mood => `
                            <div class="mood-card bg-gradient-to-br ${mood.gradient}">
                                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                <h4 class="text-lg font-semibold">${mood.name}</h4>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    function renderLibrary() {
        const maxHours = Math.max(...weeklyData.map(d => d.hours), 1);
        const totalHours = platformData.reduce((sum, p) => sum + p.value, 0);
        return `
            <div class="space-y-6">
                <div class="grid grid-cols-2 gap-6">
                    <div class="card">
                        <h3 class="text-xl font-semibold mb-6">Weekly Report</h3>
                        <div class="flex items-end gap-3 h-48">
                            ${weeklyData.map(d => `
                                <div class="flex-1 flex flex-col items-center gap-2">
                                    <div class="w-full bg-purple-500/30 rounded-t-lg chart-bar" style="height: ${(d.hours / maxHours) * 100}%"></div>
                                    <span class="text-xs text-gray-400">${d.day}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="mt-4 text-sm text-gray-400">Total: <span class="text-white font-semibold">37.8 hours</span> this week</div>
                    </div>
                    <div class="card">
                        <h3 class="text-xl font-semibold mb-6">Listening Time</h3>
                        <div class="flex items-center justify-between">
                            <div class="w-32 h-32 rounded-full border-8 border-purple-500/30 flex items-center justify-center">
                                <div class="text-center">
                                    <div class="text-2xl font-bold">${totalHours}</div>
                                    <div class="text-xs text-gray-400">Hours</div>
                                </div>
                            </div>
                            <div class="flex-1 space-y-3 ml-6">
                                ${platformData.map(p => `
                                    <div class="flex items-center justify-between text-sm">
                                        <div class="flex items-center gap-2">
                                            <div class="w-3 h-3 rounded-full" style="background-color: ${p.color}"></div>
                                            <span>${p.name}</span>
                                        </div>
                                        <span class="text-gray-400">${p.value}h</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <h3 class="text-xl font-semibold mb-6">My Playlists</h3>
                    <div class="grid grid-cols-5 gap-4">
                        ${playlists.map(playlist => `
                            <div class="cursor-pointer rounded-lg p-3 transition-all ${selectedPlaylist && selectedPlaylist.id === playlist.id ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-white/5 border border-transparent hover:bg-white/10'}" data-playlist-id="${playlist.id}">
                                <div class="aspect-square rounded-lg overflow-hidden mb-3">
                                    <img src="${playlist.cover}" alt="${playlist.name}" class="w-full h-full object-cover">
                                </div>
                                <h4 class="font-medium text-sm truncate">${playlist.name}</h4>
                                <p class="text-xs text-gray-400">${playlist.tracks} tracks • ${playlist.duration}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="card">
                    <h3 class="text-xl font-semibold mb-6">${selectedPlaylist ? selectedPlaylist.name : 'Tracks'}</h3>
                    <div class="space-y-2">
                        ${tracks.map((track, index) => `
                            <div class="track-row group">
                                <div class="w-8 text-gray-400 text-sm">${index + 1}</div>
                                <div class="track-play">
                                    <svg class="w-4 h-4 fill-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="font-medium truncate">${track.title}</div>
                                    <div class="text-sm text-gray-400 truncate">${track.artist}</div>
                                </div>
                                <div class="text-sm text-gray-400">${track.album}</div>
                                <div class="text-sm text-gray-400 w-16 text-right">${track.duration}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    function renderSettings() {
        return `
            <div class="max-w-4xl mx-auto space-y-6">
                <h1 class="text-3xl font-bold mb-8">Settings</h1>
                <div class="card">
                    <h2 class="text-xl font-semibold mb-6">应用主题与外观</h2>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-sm text-gray-400 mb-3">主题模式</label>
                            <div class="flex gap-2">
                                ${['light', 'dark', 'system'].map(t => `
                                    <button class="px-4 py-2 rounded-lg border ${settings.theme === t ? 'bg-purple-500/20 text-purple-400 border-purple-500' : 'border-white/10 text-gray-400 hover:bg-white/5'} transition-colors" data-theme="${t}">
                                        ${t === 'light' ? '亮色' : t === 'dark' ? '暗色' : '跟随系统'}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                        <div class="pt-4 border-t border-white/10 flex items-center justify-between">
                            <div>
                                <div class="font-medium">自动播放</div>
                                <div class="text-sm text-gray-400">启动时自动播放上次歌曲</div>
                            </div>
                            <label class="switch">
                                <input type="checkbox" id="auto-play" ${settings.autoPlay ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <h2 class="text-xl font-semibold mb-6">歌词显示</h2>
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="font-medium">桌面歌词浮窗</div>
                                <div class="text-sm text-gray-400">在桌面显示独立的歌词窗口</div>
                            </div>
                            <label class="switch">
                                <input type="checkbox" id="desktop-lyrics" ${settings.desktopLyrics ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="flex items-center justify-between pt-4 border-t border-white/10">
                            <div>
                                <div class="font-medium">歌词颜色跟随专辑</div>
                                <div class="text-sm text-gray-400">根据专辑封面自动调整歌词颜色</div>
                            </div>
                            <label class="switch">
                                <input type="checkbox" id="color-follow" ${settings.colorFollowAlbum ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-xl font-semibold">曲库与存储</h2>
                        <button id="add-path-btn" class="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg border border-purple-500/30 transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                            添加路径
                        </button>
                    </div>
                    <div class="space-y-3 mb-6">
                        ${localPaths.map(path => `
                            <div class="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                                <div class="flex-1 min-w-0">
                                    <div class="font-medium truncate">${path.path}</div>
                                    <div class="text-sm text-gray-400">${path.trackCount} 首歌曲</div>
                                </div>
                                <button class="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400" data-remove-path="${path.id}">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <button id="rescan-btn" class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        立即重新扫描
                    </button>
                </div>
                <div class="card">
                    <h2 class="text-xl font-semibold mb-6">服务绑定状态</h2>
                    <div class="space-y-4">
                        <div class="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                    <span class="text-xl font-bold">S</span>
                                </div>
                                <div>
                                    <div class="font-medium">Spotify</div>
                                    <div class="text-sm text-gray-400">未连接</div>
                                </div>
                            </div>
                            <button class="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg border border-green-500/30 transition-colors text-green-400">立即绑定</button>
                        </div>
                        <div class="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                                    <span class="text-xl font-bold">网</span>
                                </div>
                                <div>
                                    <div class="font-medium">网易云音乐</div>
                                    <div class="text-sm text-gray-400 flex items-center gap-2">
                                        <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                        已登录 (user@example.com)
                                    </div>
                                </div>
                            </div>
                            <button class="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg border border-red-500/30 transition-colors text-red-400">注销</button>
                        </div>
                    </div>
                </div>
                <div class="h-24"></div>
            </div>
        `;
    }

    function renderPlayerBar() {
        return `
            <div class="player-bar px-6 flex items-center gap-6 text-white">
                <div class="flex items-center gap-4 w-80">
                    <div class="w-16 h-16 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center overflow-hidden">
                        <img src="https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=200&h=200&fit=crop" alt="Album" class="w-full h-full object-cover">
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-medium truncate">Midnight Jazz</div>
                        <div class="text-sm text-gray-400 truncate">Smooth Jazz Ensemble</div>
                    </div>
                    <button id="like-btn" class="p-2 hover:bg-white/5 rounded-full transition-colors">
                        <svg class="w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400'}" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                    </button>
                </div>
                <div class="flex-1 flex flex-col items-center gap-2">
                    <div class="flex items-center gap-4">
                        <button class="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                        </button>
                        <button id="play-pause-btn" class="play-button">
                            ${isPlaying ? 
                                '<svg class="w-6 h-6 fill-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>' :
                                '<svg class="w-6 h-6 fill-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'
                            }
                        </button>
                        <button class="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                        </button>
                    </div>
                    <div class="w-full max-w-2xl flex items-center gap-3">
                        <span class="text-xs text-gray-400 w-10 text-right">${formatTime(currentTime)}</span>
                        <input type="range" id="progress-slider" min="0" max="100" value="${progress}" class="flex-1">
                        <span class="text-xs text-gray-400 w-10">${formatTime(duration)}</span>
                    </div>
                </div>
                <div class="flex items-center gap-4 w-80 justify-end">
                    <button class="p-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full hover:from-purple-500/30 hover:to-pink-500/30 transition-colors border border-purple-500/30">
                        <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
                    </button>
                    <div class="flex items-center gap-2">
                        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
                        <input type="range" id="volume-slider" min="0" max="100" value="${volume}" class="w-24">
                    </div>
                </div>
            </div>
        `;
    }

    function renderPlayer() {
        const playerBar = document.querySelector('.player-bar');
        if (playerBar) {
            playerBar.outerHTML = renderPlayerBar();
            attachPlayerEvents();
        }
    }

    function attachEventListeners() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                currentView = item.dataset.path;
                render();
            });
        });

        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        if (chatInput && sendBtn) {
            sendBtn.addEventListener('click', sendMessage);
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMessage();
            });
        }

        document.querySelectorAll('[data-playlist-id]').forEach(el => {
            el.addEventListener('click', () => {
                const id = parseInt(el.dataset.playlistId);
                selectedPlaylist = playlists.find(p => p.id === id);
                sendToCSharp('getTracks', id.toString());
                render();
            });
        });

        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', () => {
                settings.theme = btn.dataset.theme;
                sendToCSharp('saveSettings', JSON.stringify(settings));
                render();
            });
        });

        const autoPlay = document.getElementById('auto-play');
        if (autoPlay) {
            autoPlay.addEventListener('change', () => {
                settings.autoPlay = autoPlay.checked;
                sendToCSharp('saveSettings', JSON.stringify(settings));
            });
        }

        const desktopLyrics = document.getElementById('desktop-lyrics');
        if (desktopLyrics) {
            desktopLyrics.addEventListener('change', () => {
                settings.desktopLyrics = desktopLyrics.checked;
                sendToCSharp('saveSettings', JSON.stringify(settings));
            });
        }

        const colorFollow = document.getElementById('color-follow');
        if (colorFollow) {
            colorFollow.addEventListener('change', () => {
                settings.colorFollowAlbum = colorFollow.checked;
                sendToCSharp('saveSettings', JSON.stringify(settings));
            });
        }

        const addPathBtn = document.getElementById('add-path-btn');
        if (addPathBtn) {
            addPathBtn.addEventListener('click', () => {
                const path = prompt('请输入音乐文件夹路径:');
                if (path) {
                    sendToCSharp('addLocalPath', JSON.stringify({ path }));
                }
            });
        }

        document.querySelectorAll('[data-remove-path]').forEach(btn => {
            btn.addEventListener('click', () => {
                sendToCSharp('removeLocalPath', btn.dataset.removePath);
            });
        });

        const rescanBtn = document.getElementById('rescan-btn');
        if (rescanBtn) {
            rescanBtn.addEventListener('click', () => {
                localPaths.forEach(path => {
                    sendToCSharp('scanFolder', JSON.stringify({ path: path.path }));
                });
            });
        }

        attachPlayerEvents();
    }

    function attachPlayerEvents() {
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                if (isPlaying) {
                    isPlaying = false;
                    sendToCSharp('pause');
                } else {
                    isPlaying = true;
                    sendToCSharp('resume');
                }
                renderPlayer();
            });
        }

        const progressSlider = document.getElementById('progress-slider');
        if (progressSlider) {
            progressSlider.addEventListener('input', (e) => {
                progress = parseFloat(e.target.value);
                currentTime = (progress / 100) * duration;
                sendToCSharp('setProgress', progress.toString());
            });
        }

        const volumeSlider = document.getElementById('volume-slider');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                volume = parseFloat(e.target.value);
                sendToCSharp('setVolume', volume.toString());
            });
        }

        const likeBtn = document.getElementById('like-btn');
        if (likeBtn) {
            likeBtn.addEventListener('click', () => {
                isLiked = !isLiked;
                renderPlayer();
            });
        }
    }

    function sendMessage() {
        const input = document.getElementById('chat-input');
        if (!input || !input.value.trim()) return;

        const newMessage = {
            id: Date.now().toString(),
            type: 'user',
            content: input.value,
            timestamp: new Date()
        };
        messages.push(newMessage);
        input.value = '';
        render();

        setTimeout(() => {
            const aiResponse = {
                id: (Date.now() + 1).toString(),
                type: 'ai',
                content: '好的，让我为您推荐符合您心情的音乐...',
                timestamp: new Date()
            };
            messages.push(aiResponse);
            render();
        }, 1000);
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
