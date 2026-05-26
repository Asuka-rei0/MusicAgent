const App = (() => {
    let currentView = 'ai-recommend';
    let isPlaying = false;
    let progress = 0;
    let volume = 70;
    let currentTime = 0;
    let duration = 0;
    let currentFilePath = '';
    let currentTrackTitle = 'Unknown Track';
    let currentTrackArtist = 'Unknown Artist';
    let currentCoverUrl = '';
    let currentQueueIndex = -1;
    let playbackStrategy = 'normal';
    let isLiked = false;
    let messages = [];
    let tracks = [];
    let weeklyData = [];
    let platformData = [];
    let localPaths = [];
    let settings = { theme: 'dark', autoPlay: true, desktopLyrics: false, colorFollowAlbum: true };
    let selectedPlaylist = null;
    let hasAutoScannedLocalPaths = false;
    let isScanningLocalPaths = false;
    let currentSourceUri = '';
    let loadedLyricsKey = '';
    let lastActiveLyricIndex = -1;
    let listeningBufferSeconds = 0;
    let lastProgressFilePath = '';
    let lastProgressTime = 0;
    let lastProgressWasPlaying = false;
    let hasLoadedLocalPaths = false;
    let hasAutoRestoredPlayback = false;
    let pendingRestoreTime = 0;
    let lastPlaybackStateSavedAt = 0;
    let isAutoAdvancing = false;
    let lyrics = [{ text: 'No lyrics loaded', time: 0 }];
    let aiConfig = loadAIConfig();
    let aiState = { isLoading: false, error: null };
    let aiRecommendedTracks = [];
    let neteaseStatus = {
        loggedIn: false,
        nickname: '',
        avatarUrl: '',
        apiBaseUrl: 'http://127.0.0.1:3000',
        lastSyncAt: null,
        playlistCount: 0
    };
    let neteasePlaylists = [];
    let neteaseTracks = [];
    let neteaseQrImage = '';
    let neteaseQrMessage = '';
    let neteaseQrPollTimer = null;
    let isNeteaseSyncing = false;
    let isLoadingNeteaseTracks = false;
    const aiSystemPrompt = [
        'You are an AI music assistant for MusicAgent.',
        'Help users discover music based on mood, preferences, and listening habits.',
        'Keep responses concise, friendly, and music-focused.',
        'When recommending, mention specific songs or artists when possible.'
    ].join(' ');

    const navItems = [
        { path: 'ai-recommend', label: 'AI Recommend', icon: 'sparkles' },
        { path: 'explore', label: 'Explore', icon: 'compass' },
        { path: 'library', label: 'Music Library', icon: 'library' },
        { path: 'settings', label: 'Settings', icon: 'settings' }
    ];

    function init() {
        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.addEventListener('message', handleWebMessage);
        } else {
            window.addEventListener('message', handleWebMessage);
        }
        window.addEventListener('beforeunload', () => savePlaybackState(currentTime, true));
        loadInitialData();
        applyTheme();
        render();
        startProgressTimer();
        window.addEventListener('resize', () => {
            if (currentView === 'ai-recommend') {
                updateLyricsPadding();
            }
        });
    }

    function handleWebMessage(event) {
        const response = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        const action = response.action || response.Action;
        const data = response.data ?? response.Data;
        console.log('Received from C#:', response);
        
        switch (action) {
            case 'error':
                alert(`Backend processing failed: ${data}`);
                break;
            case 'getWeeklyData':
                weeklyData = JSON.parse(data).map(item => ({
                    day: item.day ?? item.Day,
                    hours: Number(item.hours ?? item.Hours ?? 0),
                    platforms: (item.platforms ?? item.Platforms ?? []).map(slice => ({
                        name: slice.name ?? slice.Name,
                        hours: Number(slice.hours ?? slice.Hours ?? 0),
                        color: slice.color ?? slice.Color ?? '#8B5CF6'
                    }))
                }));
                if (currentView === 'library') renderLibraryStats();
                break;
            case 'getPlatformData':
                platformData = JSON.parse(data).map(item => ({
                    name: item.name ?? item.Name,
                    value: Number(item.value ?? item.Value ?? 0),
                    color: item.color ?? item.Color ?? '#8B5CF6'
                }));
                if (currentView === 'library') renderLibraryStats();
                break;
            case 'getLocalPaths':
                localPaths = normalizeLocalPaths(JSON.parse(data));
                hasLoadedLocalPaths = true;
                syncTracksWithLocalPaths();
                syncSelectedPlaylistWithLocalPaths();
                autoScanLocalPaths();
                tryAutoRestorePlayback();
                render();
                break;
            case 'addLocalPath':
                applyAddLocalPathResponse(data);
                render();
                break;
            case 'removeLocalPath':
                applyRemoveLocalPathResponse(data);
                render();
                break;
            case 'getSettings':
                settings = normalizeSettings(JSON.parse(data));
                applyTheme();
                render();
                tryAutoRestorePlayback();
                break;
            case 'scanFolder':
                applyScanFolderResponse(data);
                render();
                break;
            case 'getLyrics':
                applyLyricsResponse(data);
                renderLyricsPanel();
                break;
            case 'play':
            case 'pause':
            case 'resume':
            case 'next':
            case 'previous':
            case 'setQueue':
            case 'setPlaybackStrategy':
            case 'setProgress':
            case 'setVolume':
            case 'getAudioState':
            case 'getProgress':
                applyAudioState(data);
                renderPlayer();
                break;
            case 'recordListeningTime':
                sendToCSharp('getWeeklyData');
                sendToCSharp('getPlatformData');
                break;
            case 'getNeteaseStatus':
                applyNeteaseStatus(data);
                if (currentView === 'settings') {
                    renderPreservingMainScroll();
                } else if (currentView === 'library') {
                    render();
                }
                break;
            case 'setNeteaseApiBaseUrl':
            case 'neteaseLogout':
                applyNeteaseStatus(data);
                if (!neteaseStatus.loggedIn) {
                    neteasePlaylists = [];
                    neteaseTracks = [];
                }
                render();
                break;
            case 'neteaseQrStart':
                applyNeteaseQrStart(data);
                break;
            case 'neteaseQrCheck':
                applyNeteaseQrCheck(data);
                break;
            case 'syncNetease':
                applyNeteaseSync(data);
                break;
            case 'getNeteasePlaylists':
                neteasePlaylists = parseJsonData(data) || [];
                if (currentView === 'library') render();
                break;
            case 'getNeteasePlaylistTracks':
                applyNeteasePlaylistTracks(data);
                break;
        }
    }

    function applyNeteaseStatus(data) {
        const payload = parseJsonData(data);
        if (!payload || typeof payload !== 'object') return;
        neteaseStatus = {
            loggedIn: Boolean(payload.loggedIn),
            userId: payload.userId ?? 0,
            nickname: payload.nickname || '',
            avatarUrl: payload.avatarUrl || '',
            apiBaseUrl: payload.apiBaseUrl || neteaseStatus.apiBaseUrl,
            lastSyncAt: payload.lastSyncAt || null,
            playlistCount: Number(payload.playlistCount ?? 0)
        };
        if (neteaseStatus.loggedIn) {
            sendToCSharp('getNeteasePlaylists');
        }
    }

    function getMainScrollEl() {
        return document.querySelector('.main-content');
    }

    function renderPreservingMainScroll() {
        const scroller = getMainScrollEl();
        const scrollTop = scroller?.scrollTop ?? 0;
        render();
        requestAnimationFrame(() => {
            const el = getMainScrollEl();
            if (el) el.scrollTop = scrollTop;
        });
    }

    function updateNeteaseQrPanel() {
        const panel = document.getElementById('netease-qr-panel');
        const messageEl = document.getElementById('netease-qr-message');
        const imageEl = document.getElementById('netease-qr-img');
        if (!panel || !messageEl) {
            if (currentView === 'settings' && neteaseQrImage) {
                renderPreservingMainScroll();
            }
            return;
        }

        panel.classList.toggle('hidden', !neteaseQrImage);
        messageEl.textContent = neteaseQrMessage || '请使用网易云音乐 App 扫描二维码';
        if (imageEl && neteaseQrImage) {
            imageEl.src = neteaseQrImage;
        }
    }

    function applyNeteaseQrStart(data) {
        const payload = parseJsonData(data);
        if (payload?.errorMessage) {
            alert(payload.errorMessage);
            return;
        }
        neteaseQrImage = payload?.qrImage || '';
        neteaseQrMessage = payload?.message || '请使用网易云音乐 App 扫描二维码';
        stopNeteaseQrPoll();
        renderPreservingMainScroll();
        neteaseQrPollTimer = setInterval(() => sendToCSharp('neteaseQrCheck'), 2000);
    }

    function applyNeteaseQrCheck(data) {
        const payload = parseJsonData(data);
        if (!payload) return;

        if (payload.errorMessage || payload.success === false) {
            stopNeteaseQrPoll();
            neteaseQrImage = '';
            alert(payload.errorMessage || payload.message || '扫码登录失败');
            renderPreservingMainScroll();
            return;
        }

        neteaseQrMessage = payload.message || neteaseQrMessage;
        if (payload.status === 'success') {
            stopNeteaseQrPoll();
            neteaseQrImage = '';
            sendToCSharp('getNeteaseStatus');
            const name = payload.profile?.nickname || '网易云用户';
            alert(`网易云登录成功：${name}。可点击「同步歌单与听歌数据」。`);
            renderPreservingMainScroll();
            return;
        }
        if (payload.status === 'expired') {
            stopNeteaseQrPoll();
            neteaseQrImage = '';
            updateNeteaseQrPanel();
            alert(payload.message || '二维码已过期，请重新获取。');
            return;
        }
        if (payload.status === 'waiting') {
            updateNeteaseQrPanel();
        }
    }

    function applyNeteaseSync(data) {
        isNeteaseSyncing = false;
        const payload = parseJsonData(data);
        if (!payload?.success) {
            alert(payload?.errorMessage || payload?.message || '同步失败');
            render();
            return;
        }
        neteaseStatus.lastSyncAt = payload.lastSyncAt || neteaseStatus.lastSyncAt;
        neteaseStatus.playlistCount = Number(payload.playlistCount ?? neteaseStatus.playlistCount);
        sendToCSharp('getNeteasePlaylists');
        sendToCSharp('getWeeklyData');
        sendToCSharp('getPlatformData');
        alert(payload.message || '同步完成');
        render();
    }

    function applyNeteasePlaylistTracks(data) {
        isLoadingNeteaseTracks = false;
        const payload = parseJsonData(data);
        if (payload?.errorMessage) {
            alert(payload.errorMessage);
            render();
            return;
        }

        neteaseTracks = Array.isArray(payload?.tracks) ? payload.tracks.map(normalizeTrack) : [];
        if (neteaseTracks.length > 0 && !neteaseTracks.some(t => String(t.coverUrl || '').trim())) {
            console.warn('曲目缺少封面，请在设置中重新「同步网易云」。');
        }
        render();

        if (neteaseTracks.length === 0) {
            alert(payload?.message || '该歌单暂无曲目，请重新同步网易云数据。');
            return;
        }
    }

    function stopNeteaseQrPoll() {
        if (neteaseQrPollTimer) {
            clearInterval(neteaseQrPollTimer);
            neteaseQrPollTimer = null;
        }
    }

    function formatPlatformName(name) {
        if (!name) return name;
        const key = String(name).toLowerCase();
        if (key === 'netease') return '网易云';
        return name;
    }

    function applyAudioState(data) {
        const progressData = parseJsonData(data);
        if (!progressData || typeof progressData !== 'object') return;

        const previousSourceUri = currentSourceUri;
        const nextFilePath = progressData.filePath || currentFilePath;
        const statsPath = progressData.logicalSourceUri || progressData.trackId || progressData.sourceUri || nextFilePath;
        updateListeningStats(statsPath, Number(progressData.currentTime ?? currentTime) || 0, Boolean(progressData.isPlaying));

        progress = Number(progressData.progress ?? progress) || 0;
        currentTime = Number(progressData.currentTime ?? currentTime) || 0;
        duration = Number(progressData.duration ?? duration) || duration;
        volume = Number(progressData.volume ?? volume) || volume;
        isPlaying = Boolean(progressData.isPlaying);
        currentFilePath = nextFilePath;
        currentSourceUri = statsPath;
        currentTrackTitle = progressData.title || getFileNameWithoutExtension(statsPath) || currentTrackTitle;
        currentTrackArtist = progressData.artist || currentTrackArtist || 'Unknown Artist';
        currentCoverUrl = progressData.coverUrl || currentCoverUrl || '';
        currentQueueIndex = Number.isFinite(Number(progressData.currentIndex))
            ? Number(progressData.currentIndex)
            : currentQueueIndex;
        playbackStrategy = progressData.playbackStrategy || playbackStrategy;
        const status = String(progressData.status || '');

        if (status !== 'Ended') {
            isAutoAdvancing = false;
        }

        if (progressData.errorMessage) {
            console.warn('AudioCore error:', progressData.errorMessage);
        }

        if (currentSourceUri && currentSourceUri !== previousSourceUri) {
            requestLyricsForSource(currentSourceUri);
        }

        syncLyricHighlight();

        if (currentSourceUri && currentSourceUri !== previousSourceUri) {
            savePlaybackState(0, true);
        }

        if (pendingRestoreTime > 0 && duration > 0) {
            const restorePercent = Math.min((pendingRestoreTime / duration) * 100, 99);
            pendingRestoreTime = 0;
            sendToCSharp('setProgress', restorePercent.toString());
        }

        maybeSavePlaybackState();

        if (status === 'Ended' && !isAutoAdvancing && Number(progressData.queueCount || 0) > 1) {
            isAutoAdvancing = true;
            sendToCSharp('next');
        }

        if (currentView === 'library') {
            const playerBar = document.querySelector('.player-bar');
            if (playerBar) {
                renderPlayer();
            } else {
                updateTrackListHighlight();
            }
        }
    }

    function applyScanFolderResponse(data) {
        const scanData = parseJsonData(data);
        if (!scanData || !Array.isArray(scanData.files)) {
            isScanningLocalPaths = false;
            alert(`Scan failed: ${data}`);
            return;
        }

        const scannedPath = scanData.path || scanData.Path || '';
        const scannedTracks = Array.isArray(scanData.tracks || scanData.Tracks)
            ? (scanData.tracks || scanData.Tracks).map(normalizeTrack)
            : scanData.files.map((filePath) => ({
                id: `local-${filePath}`,
                title: getFileNameWithoutExtension(filePath),
                artist: 'Unknown Artist',
                album: getParentFolderName(filePath),
                duration: '--:--',
                durationMs: null,
                filePath
            }));

        if (scannedPath) {
            tracks = tracks.filter(track => !(track.filePath && track.filePath.startsWith(scannedPath)));
            const pathIndex = localPaths.findIndex(path => path.path === scannedPath);
            if (pathIndex >= 0) {
                localPaths[pathIndex] = {
                    ...localPaths[pathIndex],
                    trackCount: scanData.count ?? scannedTracks.length
                };
                if (selectedPlaylist?.isLocal && selectedPlaylist.path === scannedPath) {
                    selectedPlaylist = getLibraryPlaylists()[pathIndex];
                }
            }
        }

        const existingPaths = new Set(tracks.map(track => track.filePath));
        scannedTracks.forEach(track => {
            if (!existingPaths.has(track.filePath)) {
                tracks.push(track);
            }
        });
        isScanningLocalPaths = false;

        if (scannedTracks.length === 0) {
            alert('Scan completed, but no supported audio files were found in this folder.');
        }
        tryAutoRestorePlayback();
    }

    function applyAddLocalPathResponse(data) {
        const pathData = parseJsonData(data);
        const pathValue = pathData?.path || pathData?.Path;
        if (!pathData || typeof pathData !== 'object' || !pathValue) {
            console.warn('Add local path failed:', data);
            alert(`Failed to add path: ${data}`);
            return;
        }

        const normalizedPath = {
            id: pathData.id || pathData.Id,
            path: pathValue,
            trackCount: pathData.trackCount ?? pathData.TrackCount ?? 0
        };

        const existingIndex = localPaths.findIndex(path => path.id === normalizedPath.id || path.path === normalizedPath.path);
        if (existingIndex >= 0) {
            localPaths[existingIndex] = normalizedPath;
        } else {
            localPaths.push(normalizedPath);
        }

        alert(`已添加曲库路径，开始扫描：${normalizedPath.path}`);
        selectedPlaylist = getLibraryPlaylists().find(playlist => playlist.path === normalizedPath.path) || selectedPlaylist;
        isScanningLocalPaths = true;
        sendToCSharp('scanFolder', JSON.stringify({ Path: normalizedPath.path }));
    }

    function normalizeLocalPaths(paths) {
        if (!Array.isArray(paths)) return [];

        return paths.map(path => ({
            id: path.id || path.Id,
            path: path.path || path.Path,
            trackCount: path.trackCount ?? path.TrackCount ?? 0
        }));
    }

    function syncTracksWithLocalPaths() {
        tracks = tracks.filter(track => {
            if (!track.filePath) return true;
            return localPaths.some(path => path.path && track.filePath.startsWith(path.path));
        });
    }

    function syncSelectedPlaylistWithLocalPaths() {
        const libraryPlaylists = getLibraryPlaylists();
        if (libraryPlaylists.length === 0) {
            selectedPlaylist = null;
            return;
        }

        if (selectedPlaylist?.isNetease) {
            const stillExists = libraryPlaylists.some(playlist => playlist.id === selectedPlaylist.id);
            if (!stillExists) selectedPlaylist = libraryPlaylists[0];
            return;
        }

        if (!selectedPlaylist?.isLocal || !libraryPlaylists.some(playlist => playlist.path === selectedPlaylist.path)) {
            selectedPlaylist = libraryPlaylists[0];
        }
    }

    function getLibraryPlaylists() {
        const cloud = neteasePlaylists.map(playlist => ({
            id: `netease-${playlist.externalId}`,
            externalId: playlist.externalId,
            isLocal: false,
            isNetease: true,
            name: playlist.name || '网易云歌单',
            tracks: playlist.trackCount ?? 0,
            duration: '网易云',
            cover: (playlist.coverUrl || '').trim() || getDefaultCover(),
            path: ''
        }));
        const local = localPaths.map((path, index) => ({
            id: `local-path-${path.id || index}`,
            sourceIndex: index,
            isLocal: true,
            isNetease: false,
            name: getFolderDisplayName(path.path),
            tracks: path.trackCount ?? 0,
            duration: 'Local Library',
            cover: getDefaultCover(),
            path: path.path
        }));
        return [...cloud, ...local];
    }

    function parseNeteaseSongId(source) {
        if (!source || !String(source).startsWith('netease:')) return null;
        const idPart = String(source).slice('netease:'.length).split(':')[0];
        return idPart || null;
    }

    function normalizeTrack(track) {
        const rawSource = track.sourceUri ?? track.SourceUri ?? track.filePath ?? track.FilePath ?? '';
        const isNetease = Boolean(track.isNetease) || String(rawSource).startsWith('netease:');
        const songId = track.songId ?? track.SongId ?? (isNetease ? parseNeteaseSongId(rawSource) : null);
        const sourceUri = isNetease
            ? (rawSource || (songId ? `netease:${songId}` : ''))
            : rawSource;

        return {
            id: track.id ?? track.Id ?? (songId ? `netease-${songId}` : sourceUri),
            songId,
            isNetease,
            title: track.title ?? track.Title ?? getFileNameWithoutExtension(sourceUri),
            artist: track.artist ?? track.Artist ?? 'Unknown Artist',
            album: track.album ?? track.Album ?? (isNetease ? '网易云音乐' : 'Local Music'),
            duration: track.duration ?? track.Duration ?? '--:--',
            durationMs: track.durationMs ?? track.DurationMs ?? null,
            coverUrl: track.coverUrl ?? track.CoverUrl ?? '',
            filePath: isNetease ? '' : sourceUri,
            sourceUri
        };
    }

    function getActiveTrackList() {
        if (selectedPlaylist?.isNetease) {
            return neteaseTracks;
        }
        if (selectedPlaylist?.isLocal) {
            return tracks.filter(track => track.filePath && track.filePath.startsWith(selectedPlaylist.path));
        }
        return tracks;
    }

    function findNeteasePlaylistById(playlistId) {
        return getLibraryPlaylists().find(item =>
            item.isNetease && String(item.externalId) === String(playlistId)
        );
    }

    function selectNeteasePlaylist(playlistId) {
        const playlist = findNeteasePlaylistById(playlistId);
        if (!playlist) return;

        selectedPlaylist = playlist;
        isLoadingNeteaseTracks = true;
        neteaseTracks = [];
        render();
        sendToCSharp('getNeteasePlaylistTracks', JSON.stringify({ playlistId: String(playlistId) }));
    }

    function getDefaultCover() {
        return 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=200&h=200&fit=crop';
    }

    function getFolderDisplayName(path) {
        if (!path) return 'Local Music';
        const parts = path.split(/[\\/]/).filter(Boolean);
        return parts.length > 0 ? parts[parts.length - 1] : path;
    }

    function autoScanLocalPaths() {
        if (hasAutoScannedLocalPaths || localPaths.length === 0) return;

        hasAutoScannedLocalPaths = true;
        scanAllLocalPaths();
    }

    function scanAllLocalPaths() {
        if (localPaths.length === 0) return;

        isScanningLocalPaths = true;
        render();
        localPaths.forEach(path => {
            if (path.path) {
                sendToCSharp('scanFolder', JSON.stringify({ Path: path.path }));
            }
        });
    }

    function applyRemoveLocalPathResponse(data) {
        if (typeof data === 'string' && data !== 'Removed') {
            const removedPath = parseJsonData(data);
            if (!removedPath || typeof removedPath !== 'object') {
                console.warn('Remove local path failed:', data);
                return;
            }

            removeLocalPathFromState(removedPath.id || removedPath.Id, removedPath.path || removedPath.Path);
        } else {
            sendToCSharp('getLocalPaths');
            return;
        }

        sendToCSharp('getLocalPaths');
    }

    function removeLocalPathFromState(pathId, pathValue) {
        if (!pathId && !pathValue) return;

        localPaths = localPaths.filter(path => path.id !== pathId && path.path !== pathValue);

        if (pathValue) {
            tracks = tracks.filter(track => !(track.filePath && track.filePath.startsWith(pathValue)));
        }

        const libraryPlaylists = getLibraryPlaylists();
        if (selectedPlaylist?.isLocal && (selectedPlaylist.path === pathValue || selectedPlaylist.id === `local-path-${pathId}`)) {
            selectedPlaylist = libraryPlaylists[0] || null;
        }
    }

    function parseJsonData(data) {
        if (!data || typeof data !== 'string') return data;
        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    }

    function loadAIConfig() {
        const defaults = {
            baseUrl: 'https://api.deepseek.com/v1',
            apiKey: '',
            model: 'deepseek-chat',
            temperature: 0.7,
            maxTokens: 2048
        };

        try {
            const saved = localStorage.getItem('musicagent.ai.config');
            return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
        } catch {
            return defaults;
        }
    }

    function saveAIConfig() {
        localStorage.setItem('musicagent.ai.config', JSON.stringify(aiConfig));
    }

    function getChatContext() {
        const localTrackHints = tracks
            .slice(0, 20)
            .map(track => `${track.title || getFileNameWithoutExtension(track.filePath || '')} - ${track.artist || 'Unknown Artist'}`)
            .join('\n');

        return localTrackHints
            ? `Local library candidates:\n${localTrackHints}`
            : 'The local library is empty or still scanning.';
    }

    function getAIConversationMessages(userContent) {
        const recentMessages = messages
            .slice(-8)
            .filter(msg => msg.content && msg.type !== 'system')
            .map(msg => ({
                role: msg.type === 'user' ? 'user' : 'assistant',
                content: msg.content
            }));

        return [
            { role: 'system', content: `${aiSystemPrompt}\n${getChatContext()}` },
            ...recentMessages
        ];
    }

    async function requestAIMessage(userContent) {
        if (!aiConfig.apiKey || !aiConfig.apiKey.trim()) {
            throw new Error('AI API key is not configured. Please fill it in Settings.');
        }

        const response = await fetch(`${aiConfig.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiConfig.apiKey}`
            },
            body: JSON.stringify({
                model: aiConfig.model,
                messages: getAIConversationMessages(userContent),
                temperature: Number(aiConfig.temperature) || 0.7,
                max_tokens: Number(aiConfig.maxTokens) || 2048,
                stream: false
            })
        });

        if (!response.ok) {
            let message = `AI request failed: HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                message = errorData.error?.message || errorData.message || message;
            } catch {
                try {
                    const errorText = await response.text();
                    if (errorText) message = errorText;
                } catch {
                    // keep default message
                }
            }
            throw new Error(message);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('AI service returned an empty response.');
        }

        return content;
    }

    function getKeywordsFromPrompt(prompt) {
        const lower = prompt.toLowerCase();
        const mappings = {
            tired: ['chill', 'slow', 'soft'],
            soothing: ['chill', 'soft', 'acoustic'],
            sleepy: ['slow', 'ambient', 'soft'],
            relaxed: ['chill', 'acoustic', 'soft'],
            happy: ['pop', 'upbeat', 'bright'],
            sad: ['slow', 'acoustic', 'piano'],
            focus: ['instrumental', 'ambient', 'piano'],
            focused: ['instrumental', 'ambient', 'piano'],
            workout: ['rock', 'dance', 'fast'],
            party: ['dance', 'pop', 'upbeat'],
            romantic: ['love', 'soft', 'acoustic'],
            jazz: ['jazz'],
            rock: ['rock'],
            pop: ['pop'],
            classical: ['classical', 'piano'],
            electronic: ['electronic', 'dance'],
            'lo-fi': ['lo-fi', 'chill'],
            lofi: ['lo-fi', 'chill']
        };

        const keywords = [];
        Object.entries(mappings).forEach(([word, tags]) => {
            if (lower.includes(word)) keywords.push(...tags);
        });

        return keywords.length > 0 ? [...new Set(keywords)] : ['chill', 'balanced'];
    }

    function scoreTrackByKeywords(track, keywords) {
        const haystack = [
            track.title,
            track.artist,
            track.album,
            getParentFolderName(track.filePath || '')
        ].join(' ').toLowerCase();

        return keywords.reduce((score, keyword) => {
            return score + (haystack.includes(keyword.toLowerCase()) ? 2 : 0);
        }, 0) + (track.filePath ? 1 : 0);
    }

    function recommendLocalTracks(prompt, count = 5) {
        const keywords = getKeywordsFromPrompt(prompt);
        const scored = tracks
            .filter(track => track.filePath || track.sourceUri)
            .map(track => ({ track, score: scoreTrackByKeywords(track, keywords) }))
            .sort((a, b) => b.score - a.score);

        return scored.slice(0, count).map(item => item.track);
    }

    function buildLocalRecommendationText(prompt, recommendedTracks) {
        if (recommendedTracks.length === 0) {
            return 'I can help with music recommendations, but your local library is empty right now. Add or scan a music folder in Settings, or configure an AI API key for online chat.';
        }

        const names = recommendedTracks
            .map((track, index) => `${index + 1}. ${track.title || getFileNameWithoutExtension(track.filePath || '')} - ${track.artist || 'Unknown Artist'}`)
            .join('\n');

        return `Based on "${prompt}", I picked these from your local library:\n${names}`;
    }

    function requestLyricsForSource(sourceKey) {
        if (!sourceKey || loadedLyricsKey === sourceKey) return;

        loadedLyricsKey = sourceKey;
        lastActiveLyricIndex = -1;
        lyrics = [{ text: '正在加载歌词…', time: 0 }];
        sendToCSharp('getLyrics', JSON.stringify({ filePath: sourceKey }));
        if (currentView === 'ai-recommend') {
            renderLyricsPanel();
        }
    }

    function applyLyricsResponse(data) {
        const lyricData = parseJsonData(data);
        const activeKey = currentSourceUri || currentFilePath;
        if (lyricData?.filePath && lyricData.filePath !== activeKey) {
            return;
        }

        if (!lyricData || !lyricData.found || !lyricData.content) {
            lyrics = [{ text: lyricData?.errorMessage || '未找到歌词', time: 0 }];
            lastActiveLyricIndex = -1;
            return;
        }

        const parsedLyrics = parseLrc(lyricData.content);
        if (parsedLyrics.length > 0) {
            lyrics = parsedLyrics;
        } else {
            const plainLines = lyricData.content
                .split(/\r?\n/)
                .map(line => line.replace(/\[[^\]]+\]/g, '').trim())
                .filter(Boolean);
            lyrics = plainLines.length > 0
                ? plainLines.map((text, index) => ({ text, time: index * 3 }))
                : [{ text: '暂无带时间轴的歌词', time: 0 }];
        }
        lastActiveLyricIndex = -1;
        if (currentView === 'ai-recommend') {
            renderLyricsPanel();
        }
    }

    function updateListeningStats(filePath, nextTime, nextIsPlaying) {
        if (lastProgressWasPlaying && filePath && filePath === lastProgressFilePath) {
            const delta = nextTime - lastProgressTime;
            if (delta > 0 && delta <= 10) {
                listeningBufferSeconds += delta;
            }
        }

        if (filePath !== lastProgressFilePath || !nextIsPlaying || listeningBufferSeconds >= 15) {
            flushListeningStats(filePath || lastProgressFilePath);
        }

        lastProgressFilePath = filePath;
        lastProgressTime = nextTime;
        lastProgressWasPlaying = nextIsPlaying;
    }

    function flushListeningStats(filePath = currentFilePath) {
        if (!filePath || listeningBufferSeconds < 1) return;

        sendToCSharp('recordListeningTime', JSON.stringify({
            trackPath: filePath,
            platform: getTrackPlatform(filePath),
            durationSeconds: listeningBufferSeconds
        }));
        listeningBufferSeconds = 0;
    }

    function getTrackPlatform(filePath) {
        if (!filePath) return 'Unknown';
        return String(filePath).startsWith('netease:') ? 'netease' : 'Local';
    }

    function parseLrcTimestamp(minutes, seconds, fraction) {
        const frac = fraction || '0';
        const ms = frac.length <= 2
            ? Number(frac.padEnd(2, '0')) * 10
            : Number(frac.padEnd(3, '0').slice(0, 3));
        return minutes * 60 + seconds + ms / 1000;
    }

    function isLyricMetadata(text) {
        return /^(ti|ar|al|by|offset|id|ve|key|hash|sign|qq|total):/i.test(text);
    }

    function parseLrc(content) {
        const timeTagPattern = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
        const parsed = [];

        content.split(/\r?\n/).forEach(line => {
            const tags = [...line.matchAll(timeTagPattern)];
            if (tags.length === 0) return;

            const text = line.replace(timeTagPattern, '').trim();
            if (!text || isLyricMetadata(text)) return;

            tags.forEach(tag => {
                parsed.push({
                    time: parseLrcTimestamp(Number(tag[1]), Number(tag[2]), tag[3]),
                    text
                });
            });
        });

        return parsed.sort((a, b) => a.time - b.time);
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderMarkdown(text) {
        if (!text) return '';
        let html = escapeHtml(text);
        html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-white/5 rounded-lg p-3 my-2 overflow-x-auto text-xs"><code>$1</code></pre>');
        html = html.replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-xs">$1</code>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
        html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-3 mb-1">$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-3 mb-1">$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-3 mb-1">$1</h1>');
        html = html.replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
        html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');
        html = html.replace(/\n/g, '<br>');
        html = html.replace(/<br><li/g, '<li');
        html = html.replace(/<\/li><br>/g, '</li>');
        return html;
    }

    function scrollChatToBottom() {
        requestAnimationFrame(() => {
            const chatContainer = document.getElementById('chat-messages');
            if (chatContainer) {
                chatContainer.scrollTo({
                    top: chatContainer.scrollHeight,
                    behavior: 'smooth'
                });
            }
        });
    }

    function sendToCSharp(action, data = '') {
        const message = { id: Date.now().toString(), action, data };
        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.postMessage(JSON.stringify(message));
        } else {
            console.log('Mock message to C#:', message);
        }
    }

    function normalizeTheme(theme) {
        return theme === 'light' ? 'light' : 'dark';
    }

    function normalizeSettings(rawSettings) {
        const source = rawSettings || {};
        return {
            id: source.id ?? source.Id ?? settings.id ?? 1,
            theme: normalizeTheme(source.theme ?? source.Theme ?? settings.theme),
            autoPlay: Boolean(source.autoPlay ?? source.AutoPlay ?? settings.autoPlay),
            desktopLyrics: Boolean(source.desktopLyrics ?? source.DesktopLyrics ?? settings.desktopLyrics),
            colorFollowAlbum: Boolean(source.colorFollowAlbum ?? source.ColorFollowAlbum ?? settings.colorFollowAlbum),
            lastTrackPath: source.lastTrackPath ?? source.LastTrackPath ?? settings.lastTrackPath ?? '',
            lastPlaybackTime: Number(source.lastPlaybackTime ?? source.LastPlaybackTime ?? settings.lastPlaybackTime ?? 0) || 0
        };
    }

    function applyTheme() {
        settings.theme = normalizeTheme(settings.theme);
        document.body.classList.toggle('theme-light', settings.theme === 'light');
        document.body.classList.toggle('theme-dark', settings.theme === 'dark');
    }

    function normalizePathForCompare(path) {
        return String(path || '').replace(/\\/g, '/').toLowerCase();
    }

    function findTrackIndexByPath(path) {
        const target = normalizePathForCompare(path);
        if (!target) return -1;
        return tracks.findIndex(track => normalizePathForCompare(track.filePath || track.sourceUri) === target);
    }

    function findCurrentPlaylistTrackIndexByPath(path) {
        const target = normalizePathForCompare(path);
        if (!target) return -1;
        return getActiveTrackList().findIndex(track => normalizePathForCompare(track.filePath || track.sourceUri) === target);
    }

    function selectPlaylistForTrack(path) {
        const target = normalizePathForCompare(path);
        if (!target) return;

        const playlist = getLibraryPlaylists()
            .filter(item => item.isLocal)
            .find(item => {
                const playlistPath = normalizePathForCompare(item.path);
                return playlistPath && target.startsWith(playlistPath);
            });

        if (playlist) selectedPlaylist = playlist;
    }

    function tryAutoRestorePlayback() {
        if (hasAutoRestoredPlayback || !settings.autoPlay || !settings.lastTrackPath) return;
        if (!hasLoadedLocalPaths) return;

        const trackIndex = findTrackIndexByPath(settings.lastTrackPath);
        if (trackIndex >= 0) {
            hasAutoRestoredPlayback = true;
            pendingRestoreTime = Math.max(0, Number(settings.lastPlaybackTime) || 0);
            selectPlaylistForTrack(settings.lastTrackPath);
            const playlistTrackIndex = findCurrentPlaylistTrackIndexByPath(settings.lastTrackPath);
            playTrackFromQueue(playlistTrackIndex >= 0 ? playlistTrackIndex : 0, { skipSave: true });
            return;
        }

        if (localPaths.length > 0 && isScanningLocalPaths) return;

        hasAutoRestoredPlayback = true;
        pendingRestoreTime = Math.max(0, Number(settings.lastPlaybackTime) || 0);
        playFile(settings.lastTrackPath, getFileNameWithoutExtension(settings.lastTrackPath), 'Local file', { skipSave: true });
    }

    function savePlaybackState(playbackTime = currentTime, force = false) {
        const playbackSource = currentSourceUri || currentFilePath;
        if (!playbackSource) return;

        const now = Date.now();
        if (!force && now - lastPlaybackStateSavedAt < 10000) return;

        lastPlaybackStateSavedAt = now;
        settings.lastTrackPath = playbackSource;
        settings.lastPlaybackTime = Math.max(0, Number(playbackTime) || 0);
        sendToCSharp('savePlaybackState', JSON.stringify({
            lastTrackPath: settings.lastTrackPath,
            lastPlaybackTime: settings.lastPlaybackTime
        }));
    }

    function maybeSavePlaybackState() {
        if (!isPlaying) return;
        savePlaybackState(currentTime);
    }

    function loadInitialData() {
        sendToCSharp('getWeeklyData');
        sendToCSharp('getPlatformData');
        sendToCSharp('getLocalPaths');
        sendToCSharp('getSettings');
        sendToCSharp('getNeteaseStatus');
    }

    function startProgressTimer() {
        setInterval(() => {
            if (isPlaying) {
                sendToCSharp('getProgress');
            }
        }, 1000);
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function getFileNameWithoutExtension(filePath) {
        const fileName = filePath.split(/[\\/]/).pop() || filePath;
        const dotIndex = fileName.lastIndexOf('.');
        return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
    }

    function getParentFolderName(filePath) {
        const parts = filePath.split(/[\\/]/).filter(Boolean);
        return parts.length > 1 ? parts[parts.length - 2] : 'Local Music';
    }

    function playFile(filePath, title = getFileNameWithoutExtension(filePath), artist = 'Local file', options = {}) {
        if (!filePath) return;

        currentFilePath = filePath;
        currentSourceUri = filePath;
        currentTrackTitle = title;
        currentTrackArtist = artist;
        isPlaying = true;
        requestLyricsForSource(filePath);
        if (!options.skipSave) savePlaybackState(0, true);
        sendToCSharp('play', JSON.stringify({ filePath }));
        renderPlayer();
    }

    function toQueueTrack(track, index) {
        const sourceUri = track.sourceUri || track.filePath || '';
        return {
            id: String(track.id || sourceUri || `track-${index}`),
            title: track.title || getFileNameWithoutExtension(sourceUri),
            artist: track.artist || 'Unknown Artist',
            sourceUri,
            coverUrl: track.coverUrl || '',
            durationMs: track.durationMs || null
        };
    }

    function getTrackCover(track) {
        return String(track?.coverUrl || '').trim() || getDefaultCover();
    }

    function renderCoverImg(track, className = 'w-full h-full object-cover') {
        const src = getTrackCover(track);
        const fallback = getDefaultCover();
        return `<img src="${escapeHtml(src)}" alt="" class="${className}" loading="lazy" onerror="this.onerror=null;this.src='${escapeHtml(fallback)}'">`;
    }

    function updateTrackListHighlight() {
        document.querySelectorAll('[data-visible-track-index]').forEach(el => {
            const index = Number(el.dataset.visibleTrackIndex);
            el.classList.toggle('is-playing', isPlaying && currentQueueIndex === index);
        });
    }

    function getPlayableQueue(sourceTracks = getActiveTrackList()) {
        return sourceTracks
            .map(toQueueTrack)
            .filter(track => Boolean(track.sourceUri));
    }

    function playVisibleTrack(index, options = {}) {
        const list = getActiveTrackList();
        const selected = list[index];
        if (!selected) return;

        const sourceUri = selected.sourceUri || selected.filePath;
        if (!sourceUri) return;

        const queue = getPlayableQueue(list);
        const startIndex = Math.max(0, queue.findIndex(track => track.sourceUri === sourceUri || track.id === String(selected.id)));

        currentFilePath = sourceUri;
        currentSourceUri = sourceUri;
        currentTrackTitle = selected.title;
        currentTrackArtist = selected.artist;
        currentCoverUrl = getTrackCover(selected);
        currentQueueIndex = index;
        isPlaying = true;

        requestLyricsForSource(sourceUri);
        if (!options.skipSave) savePlaybackState(0, true);

        sendToCSharp('setQueue', JSON.stringify({
            tracks: queue,
            startIndex: startIndex >= 0 ? startIndex : index,
            autoPlay: true
        }));
        renderPlayer();
        if (currentView === 'library') updateTrackListHighlight();
    }

    function playTrackFromQueue(index, options = {}) {
        if (selectedPlaylist) {
            playVisibleTrack(index, options);
            return;
        }

        const selected = tracks[index];
        if (!selected?.filePath && !selected?.sourceUri) {
            promptAndPlayFile();
            return;
        }

        playVisibleTrack(Math.max(0, getActiveTrackList().findIndex(track => track === selected)), options);
    }

    function cyclePlaybackStrategy() {
        playbackStrategy = playbackStrategy === 'normal'
            ? 'shuffle'
            : playbackStrategy === 'shuffle'
                ? 'repeat'
                : 'normal';
        sendToCSharp('setPlaybackStrategy', JSON.stringify({ strategy: playbackStrategy }));
        renderPlayer();
    }

    function getPlaybackStrategyLabel() {
        if (playbackStrategy === 'shuffle') return '随机';
        if (playbackStrategy === 'repeat') return '循环';
        return '顺序';
    }

    function promptAndPlayFile() {
        const filePath = prompt('Enter the full path of a local music file:');
        if (filePath) {
            playFile(filePath);
        }
    }

    function getActiveLyricIndex() {
        if (!lyrics.length) return -1;

        const index = lyrics.findIndex((lyric, i) => {
            const nextLyric = lyrics[i + 1];
            return currentTime >= lyric.time && (!nextLyric || currentTime < nextLyric.time);
        });
        if (index >= 0) return index;
        if (currentTime >= lyrics[lyrics.length - 1].time) return lyrics.length - 1;
        return 0;
    }

    function buildDonutGradient(data) {
        const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
        if (total <= 0) return 'conic-gradient(#4b5563 0deg 360deg)';

        let start = 0;
        const segments = data.map(item => {
            const value = Number(item.value || 0);
            const end = start + (value / total) * 360;
            const segment = `${item.color || '#8B5CF6'} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
            start = end;
            return segment;
        });

        return `conic-gradient(${segments.join(', ')})`;
    }

    function getWeeklyBarHeight(hours, maxHours) {
        const value = Number(hours || 0);
        if (value <= 0) return 0;

        return Math.max((value / maxHours) * 100, 8);
    }

    function getWeeklyMaxHours() {
        const totals = weeklyData.map(day => {
            if (day.platforms?.length) {
                return day.platforms.reduce((sum, slice) => sum + Number(slice.hours || 0), 0);
            }
            return Number(day.hours || 0);
        });
        return Math.max(...totals, 0.1);
    }

    function renderWeeklyStackedBar(day, maxHours) {
        const platforms = day.platforms || [];
        const total = platforms.reduce((sum, slice) => sum + Number(slice.hours || 0), 0) || Number(day.hours || 0);
        const barHeightPct = getWeeklyBarHeight(total, maxHours);

        if (total <= 0 || platforms.length === 0) {
            return `<div class="w-full bg-gray-700/30 rounded-t-lg" style="height:4%"></div>`;
        }

        const segments = platforms.map(slice => {
            const segPct = total > 0 ? (Number(slice.hours) / total) * 100 : 0;
            return `<div class="w-full" style="height:${segPct}%;background:${slice.color};min-height:${slice.hours > 0 ? '2px' : '0'}" title="${escapeHtml(slice.name)} ${slice.hours}h"></div>`;
        }).join('');

        return `
            <div class="w-full flex flex-col justify-end rounded-t-lg overflow-hidden" style="height:${barHeightPct}%">
                ${segments}
            </div>
        `;
    }

    function getWeekTotalHours() {
        return weeklyData.reduce((sum, day) => {
            if (day.platforms?.length) {
                return sum + day.platforms.reduce((inner, slice) => inner + Number(slice.hours || 0), 0);
            }
            return sum + Number(day.hours || 0);
        }, 0);
    }

    function renderWeeklyReportCard() {
        const maxHours = getWeeklyMaxHours();
        const weekTotalHours = getWeekTotalHours();

        return `
            <div class="card">
                <h3 class="text-xl font-semibold mb-6">Weekly Report</h3>
                <div class="flex items-end gap-3 h-48">
                    ${weeklyData.map(d => `
                        <div class="flex-1 h-full flex flex-col items-center justify-end gap-2">
                            ${renderWeeklyStackedBar(d, maxHours)}
                            <span class="text-xs text-gray-400">${d.day}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="mt-4 text-sm text-gray-400">Total: <span class="text-white font-semibold">${weekTotalHours.toFixed(1)} hours</span> this week</div>
            </div>
        `;
    }

    function renderListeningTimeCard() {
        const totalHours = platformData.reduce((sum, p) => sum + Number(p.value || 0), 0);
        const donutGradient = buildDonutGradient(platformData);

        return `
            <div class="card">
                <h3 class="text-xl font-semibold mb-6">Listening Time</h3>
                <div class="flex items-center justify-between">
                    <div class="w-36 h-36 rounded-full flex items-center justify-center" style="background: ${donutGradient};">
                        <div class="w-24 h-24 rounded-full bg-gray-950 flex items-center justify-center">
                            <div class="text-center">
                            <div class="text-2xl font-bold">${totalHours.toFixed(1)}</div>
                            <div class="text-xs text-gray-400">Hours</div>
                            </div>
                        </div>
                    </div>
                    <div class="flex-1 space-y-3 ml-6">
                        ${platformData.length > 0 ? platformData.map(p => `
                            <div class="flex items-center justify-between text-sm">
                                <div class="flex items-center gap-2">
                                    <div class="w-3 h-3 rounded-full" style="background-color: ${p.color}"></div>
                                    <span>${formatPlatformName(p.name)}</span>
                                </div>
                                <span class="text-gray-400">${p.value}h</span>
                            </div>
                        `).join('') : `
                            <div class="flex items-center justify-between text-sm">
                                <div class="flex items-center gap-2">
                                    <div class="w-3 h-3 rounded-full bg-gray-600"></div>
                                    <span>No listening data</span>
                                </div>
                                <span class="text-gray-400">0h</span>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    function renderLibraryStats() {
        const weeklyEl = document.getElementById('library-weekly-report');
        if (weeklyEl) {
            weeklyEl.innerHTML = renderWeeklyReportCard();
        }

        const platformEl = document.getElementById('library-listening-time');
        if (platformEl) {
            platformEl.innerHTML = renderListeningTimeCard();
        }
    }

    function updateLyricsPadding() {
        const container = document.getElementById('lyrics-panel');
        const padTop = document.getElementById('lyrics-pad-top');
        const padBottom = document.getElementById('lyrics-pad-bottom');
        if (!container || !padTop || !padBottom) return;

        const half = Math.max(container.clientHeight / 2, 120);
        padTop.style.height = `${half}px`;
        padBottom.style.height = `${half}px`;
    }

    function scrollLyricLineIntoCenter(container, activeLine) {
        const lineRect = activeLine.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const targetTop = container.scrollTop
            + (lineRect.top - containerRect.top)
            - (container.clientHeight - lineRect.height) / 2;
        container.scrollTo({
            top: Math.max(0, targetTop),
            behavior: 'smooth'
        });
    }

    function renderLyricsPanel() {
        const lyricsPanel = document.getElementById('lyrics-panel');
        if (lyricsPanel) {
            lyricsPanel.outerHTML = renderLyricsContent();
            requestAnimationFrame(() => {
                updateLyricsPadding();
                lastActiveLyricIndex = -1;
                syncLyricHighlight();
            });
        }
    }

    function syncLyricHighlight() {
        const container = document.getElementById('lyrics-panel');
        if (!container) return;

        const activeLyricIndex = getActiveLyricIndex();
        const indexChanged = activeLyricIndex !== lastActiveLyricIndex;

        if (indexChanged) {
            lastActiveLyricIndex = activeLyricIndex;
            document.querySelectorAll('[data-lyric-index]').forEach(line => {
                const lineIndex = Number(line.dataset.lyricIndex);
                const isActive = lineIndex === activeLyricIndex;
                line.classList.toggle('lyric-active', isActive);
                line.classList.toggle('lyric-inactive', !isActive);
            });
        }

        const scrollIndex = activeLyricIndex >= 0 ? activeLyricIndex : 0;
        const activeLine = document.querySelector(`[data-lyric-index="${scrollIndex}"]`);
        if (!activeLine) return;

        if (indexChanged) {
            scrollLyricLineIntoCenter(container, activeLine);
        }
    }

    function renderLyricsContent() {
        const activeLyricIndex = getActiveLyricIndex();
        return `
            <div id="lyrics-panel" class="lyrics-panel flex-1 overflow-y-auto min-h-0" style="scrollbar-width: none;">
                <div id="lyrics-scroll-inner" class="flex flex-col items-center gap-6">
                    <div id="lyrics-pad-top" aria-hidden="true"></div>
                    ${lyrics.map((lyric, index) => `
                        <div class="lyric-line ${index === activeLyricIndex ? 'lyric-active' : 'lyric-inactive'}" data-lyric-index="${index}">${escapeHtml(lyric.text)}</div>
                    `).join('')}
                    <div id="lyrics-pad-bottom" aria-hidden="true"></div>
                </div>
            </div>
        `;
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
        if (currentView === 'ai-recommend') {
            requestAnimationFrame(() => {
                updateLyricsPadding();
                lastActiveLyricIndex = -1;
                syncLyricHighlight();
            });
        }
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
        return `
            <div class="h-full flex gap-6 overflow-hidden">
                <div class="flex-1 flex flex-col gap-6">
                    <div class="card flex-1 flex flex-col overflow-hidden">
                        <h2 class="text-xl font-semibold mb-6 flex items-center gap-2 flex-shrink-0">
                            <svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                            AI Music Assistant
                        </h2>
                        <div class="flex-1 overflow-auto space-y-4 mb-6 pr-1" id="chat-messages">
                            ${messages.map(msg => `
                                <div class="flex gap-3 ${msg.type === 'user' ? 'justify-end' : ''}">
                                    ${msg.type === 'ai' ? `<div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg></div>` : ''}
                                    <div class="message-bubble ${msg.type === 'user' ? 'message-user' : 'message-ai'}">
                                        <p class="text-sm leading-relaxed whitespace-pre-line">${renderMarkdown(msg.content)}</p>
                                        <p class="text-xs text-gray-500 mt-2">${msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    ${msg.type === 'user' ? `<div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg></div>` : ''}
                                </div>
                            `).join('')}
                            ${aiState.isLoading ? `
                                <div class="flex gap-3 flex-shrink-0">
                                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                                        <svg class="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                                    </div>
                                    <div class="message-bubble message-ai">
                                        <p class="text-sm leading-relaxed">AI is thinking...</p>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        ${aiState.error ? `<div class="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">${escapeHtml(aiState.error)}</div>` : ''}
                        <div class="flex gap-3 flex-shrink-0">
                            <input type="text" id="chat-input" placeholder="Tell me your mood or music preference..." 
                                class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/50 transition-colors text-white">
                            <button id="send-btn" class="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all flex items-center gap-2 disabled:opacity-50" ${aiState.isLoading ? 'disabled' : ''}>
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
                            <h3 class="text-2xl font-bold mb-2">${escapeHtml(aiRecommendedTracks[0]?.title || 'AI Local Picks')}</h3>
                            <p class="text-gray-400 mb-4">${escapeHtml(aiRecommendedTracks[0]?.artist || 'Ask for a mood to generate recommendations')}</p>
                            <div class="flex gap-2 text-sm text-gray-500">
                                <span></span><span>•</span><span>tracks</span><span>•</span><span></span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="w-96 card flex flex-col min-h-0 overflow-hidden">
                    <h3 class="text-lg font-semibold mb-4 flex-shrink-0">Lyrics</h3>
                    ${renderLyricsContent()}
                    <div class="mt-4 pt-4 border-t border-white/10 text-sm text-gray-500 text-center flex-shrink-0">
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
            { platform: 'Spotify', color: 'from-orange-500 to-amber-500', tracks: ['Blinding Lights', 'Save Your Tears', 'Levitating'] },
            { platform: 'NetEase Cloud', color: 'from-red-500 to-rose-600', tracks: ['Sunny Day', 'Qilixiang', 'Rice Aroma'] },
            { platform: 'Apple Music', color: 'from-yellow-400 to-amber-500', tracks: ['As It Was', 'Anti-Hero', 'Flowers'] },
            { platform: 'QQ Music', color: 'from-emerald-500 to-teal-500', tracks: ['Young and Promising', 'Wind Rises', 'Light Years Away'] }
        ];
        return `
            <div class="space-y-8">
                <div class="relative h-64 rounded-2xl overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=400&fit=crop" alt="AI Discovery" class="w-full h-full object-cover">
                    <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent flex items-center">
                        <div class="p-12">
                            <h2 class="text-4xl font-bold mb-3">AI Discovery: Today Mood Radio</h2>
                            <p class="text-lg text-gray-300 mb-6">Curated music for today based on your listening habits</p>
                            <button class="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all font-medium">Start Listening</button>
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
                            <div class="mood-card bg-gradient-to-br ${mood.gradient}" data-mood="${mood.name}">
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
        const libraryPlaylists = getLibraryPlaylists();
        const hasLocalLibraries = libraryPlaylists.length > 0;
        const hasNeteasePlaylists = neteasePlaylists.length > 0;
        const trackListTitle = selectedPlaylist?.isNetease
            ? `${selectedPlaylist.name}（网易云）`
            : (selectedPlaylist?.isLocal ? selectedPlaylist.name : 'Local Tracks');
        const visibleTracks = selectedPlaylist?.isNetease
            ? neteaseTracks
            : (selectedPlaylist?.isLocal
                ? tracks.filter(track => track.filePath && track.filePath.startsWith(selectedPlaylist.path))
                : tracks);
        const emptyTrackText = hasLocalLibraries && isScanningLocalPaths
            ? '姝ｅ湪璇诲彇宸叉湁姝屽崟姝屾洸...'
            : '鏆傛棤姝屾洸';
        const emptyTrackHint = hasLocalLibraries
            ? '鐐瑰嚮閲嶆柊鎵弿宸蹭繚瀛樼殑鏇插簱璺緞'
            : 'Click to manually enter an audio file path to play';

        return `
            <div class="space-y-6">
                <div class="grid grid-cols-2 gap-6">
                    <div id="library-weekly-report">${renderWeeklyReportCard()}</div>
                    <div id="library-listening-time">${renderListeningTimeCard()}</div>
                </div>
                <div class="card">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-semibold">歌单</h3>
                        ${neteaseStatus.loggedIn ? `
                            <button id="library-sync-netease-btn" class="px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 rounded-lg border border-red-500/30 text-red-300 transition-colors" ${isNeteaseSyncing ? 'disabled' : ''}>
                                ${isNeteaseSyncing ? '同步中…' : '同步网易云'}
                            </button>
                        ` : ''}
                    </div>
                    <div class="grid grid-cols-5 gap-4">
                        ${hasLocalLibraries || hasNeteasePlaylists ? libraryPlaylists.map(playlist => `
                            <div class="cursor-pointer rounded-lg p-3 transition-all ${selectedPlaylist && selectedPlaylist.id === playlist.id ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-white/5 border border-transparent hover:bg-white/10'}" ${playlist.isNetease ? `data-netease-playlist-id="${playlist.externalId}"` : `data-local-playlist-index="${playlist.sourceIndex}"`}>
                                <div class="aspect-square rounded-lg overflow-hidden mb-3 relative">
                                    <img src="${escapeHtml(playlist.cover || getDefaultCover())}" alt="${playlist.name || 'Playlist'}" class="w-full h-full object-cover" loading="lazy" onerror="this.onerror=null;this.src='${escapeHtml(getDefaultCover())}'">
                                    ${playlist.isNetease ? '<span class="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] rounded bg-red-500/80">网易</span>' : ''}
                                </div>
                                <h4 class="font-medium text-sm truncate">${playlist.name || 'Untitled Playlist'}</h4>
                                <p class="text-xs text-gray-400">${playlist.tracks ?? 0} 首 · ${playlist.duration || '--'}</p>
                            </div>
                        `).join('') : `
                            <button class="col-span-5 p-8 rounded-lg bg-white/5 border border-white/10 text-center hover:bg-white/10 transition-colors" data-empty-manual-play="true">
                                <div class="text-lg font-medium mb-2">鏆傛棤姝屾洸</div>
                                <div class="text-sm text-gray-400">Click to manually enter an audio file path to play</div>
                            </button>
                        `}
                    </div>
                </div>
                <div class="card">
                    <h3 class="text-xl font-semibold mb-6">${trackListTitle}${isLoadingNeteaseTracks ? ' <span class="text-sm text-gray-400 font-normal">加载中…</span>' : ''}</h3>
                    <div class="space-y-2">
                        ${visibleTracks.length > 0 ? visibleTracks.map((track, index) => `
                            <div class="track-row group ${isPlaying && currentQueueIndex === index ? 'is-playing' : ''}" data-visible-track-index="${index}">
                                <div class="w-8 text-gray-400 text-sm shrink-0">${index + 1}</div>
                                <div class="track-cover">
                                    ${renderCoverImg(track)}
                                    <div class="track-play">
                                        <svg class="w-4 h-4 fill-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                    </div>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="font-medium truncate">${track.title || 'Untitled Track'}</div>
                                    <div class="text-sm text-gray-400 truncate">${track.artist || 'Unknown Artist'}</div>
                                </div>
                                <div class="text-sm text-gray-400">${track.album || 'Local Music'}</div>
                                <div class="text-sm text-gray-400 w-16 text-right">${track.duration || '--:--'}</div>
                            </div>
                        `).join('') : `
                            <div class="w-full p-8 rounded-lg bg-white/5 border border-white/10 text-center text-gray-400">
                                <div class="text-lg font-medium mb-2 text-white">${isLoadingNeteaseTracks ? '正在加载歌单曲目…' : (selectedPlaylist?.isNetease ? '请选择网易云歌单或先同步' : emptyTrackText)}</div>
                                <div class="text-sm">${isLoadingNeteaseTracks ? '首次打开会从网易云拉取曲目' : (selectedPlaylist?.isNetease ? '打开歌单后将自动播放第一首' : emptyTrackHint)}</div>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    }
    function renderSettings() {
        return `
            <div class="max-w-4xl mx-auto space-y-6">
                <h1 class="text-3xl font-bold mb-8">设置</h1>
                <div class="card">
                    <h2 class="text-xl font-semibold mb-6">应用主题与外观</h2>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-sm text-gray-400 mb-3">主题模式</label>
                            <div class="flex gap-2">
                                ${['light', 'dark', 'system'].map(t => `
                                    <button class="px-4 py-2 rounded-lg border ${settings.theme === t ? 'bg-purple-500/20 text-purple-400 border-purple-500' : 'border-white/10 text-gray-400 hover:bg-white/5'} transition-colors" data-theme="${t}">
                                        ${t === 'light' ? '浅色' : t === 'dark' ? '深色' : '跟随系统'}
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
                                <div class="font-medium">桌面歌词</div>
                                <div class="text-sm text-gray-400">在桌面上显示当前播放歌曲的同步歌词</div>
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
                        重新扫描音乐库
                    </button>
                </div>
                <div class="card">
                    <h2 class="text-xl font-semibold mb-6">AI 服务</h2>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm text-gray-400 mb-2">接口地址</label>
                            <input id="ai-base-url" type="text" value="${escapeHtml(aiConfig.baseUrl)}" class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-500/50 transition-colors text-white">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-2">API 密钥</label>
                            <input id="ai-api-key" type="password" value="${escapeHtml(aiConfig.apiKey)}" class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-500/50 transition-colors text-white">
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-2">模型名称</label>
                            <input id="ai-model" type="text" value="${escapeHtml(aiConfig.model)}" class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-500/50 transition-colors text-white">
                        </div>
                        <div class="flex items-center justify-between pt-2">
                            <div class="text-sm text-gray-400">兼容 DeepSeek、OpenAI 以及 OpenAI 风格的聊天接口。</div>
                            <button id="save-ai-config-btn" class="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg border border-purple-500/30 transition-colors">保存 AI 设置</button>
                        </div>
                    </div>
                </div>
                <div class="card" id="netease-settings-card">
                    <h2 class="text-xl font-semibold mb-6">网易云音乐</h2>
                    <div class="space-y-4 mb-4">
                        <div>
                            <label class="block text-sm text-gray-400 mb-2">API 服务地址（NeteaseCloudMusicApi）</label>
                            <input id="netease-api-url" type="text" value="${escapeHtml(neteaseStatus.apiBaseUrl)}" class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500/50 transition-colors text-white" placeholder="http://127.0.0.1:3000">
                            <p class="text-xs text-gray-500 mt-2">需在本机先运行 NeteaseCloudMusicApi，默认端口 3000。</p>
                        </div>
                        <button id="save-netease-api-btn" class="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-sm transition-colors">保存 API 地址</button>
                    </div>
                    <div class="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                        <div class="flex items-center gap-4">
                            ${neteaseStatus.avatarUrl
                                ? `<img src="${escapeHtml(neteaseStatus.avatarUrl)}" alt="avatar" class="w-12 h-12 rounded-full object-cover">`
                                : `<div class="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center"><span class="text-xl font-bold">网</span></div>`}
                            <div>
                                <div class="font-medium">账号状态</div>
                                <div class="text-sm text-gray-400">
                                    ${neteaseStatus.loggedIn
                                        ? `已登录：${escapeHtml(neteaseStatus.nickname || '网易云用户')} · ${neteaseStatus.playlistCount} 个歌单`
                                        : '未登录'}
                                </div>
                                ${neteaseStatus.lastSyncAt ? `<div class="text-xs text-gray-500 mt-1">上次同步：${new Date(neteaseStatus.lastSyncAt).toLocaleString()}</div>` : ''}
                            </div>
                        </div>
                        <div class="flex flex-col gap-2 items-end">
                            ${neteaseStatus.loggedIn ? `
                                <button id="sync-netease-btn" class="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg border border-purple-500/30 transition-colors text-purple-200 text-sm" ${isNeteaseSyncing ? 'disabled' : ''}>${isNeteaseSyncing ? '同步中…' : '同步歌单与听歌数据'}</button>
                                <button id="netease-logout-btn" class="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg border border-red-500/30 transition-colors text-red-400 text-sm">解绑</button>
                            ` : `
                                <button id="netease-qr-login-btn" class="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg border border-red-500/30 transition-colors text-red-300">扫码登录</button>
                            `}
                        </div>
                    </div>
                    <div id="netease-qr-panel" class="mt-6 p-6 bg-white/5 rounded-xl border border-white/10 text-center ${neteaseQrImage ? '' : 'hidden'}">
                        <p id="netease-qr-message" class="text-sm text-gray-300 mb-4">${escapeHtml(neteaseQrMessage || '请使用网易云音乐 App 扫描二维码')}</p>
                        <img id="netease-qr-img" src="${escapeHtml(neteaseQrImage || '')}" alt="网易云登录二维码" class="mx-auto w-48 h-48 rounded-lg bg-white p-2">
                        <button id="cancel-netease-qr-btn" class="mt-4 text-sm text-gray-400 hover:text-white transition-colors">取消扫码</button>
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
                    <div class="w-16 h-16 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center overflow-hidden shrink-0">
                        <img src="${escapeHtml(currentCoverUrl || getDefaultCover())}" alt="Album" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='${escapeHtml(getDefaultCover())}'">
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-medium truncate">${currentTrackTitle || 'No track selected'}</div>
                        <div class="text-sm text-gray-400 truncate">${currentTrackArtist || 'Unknown Artist'}</div>
                    </div>
                    <button id="like-btn" class="p-2 hover:bg-white/5 rounded-full transition-colors">
                        <svg class="w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400'}" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                    </button>
                </div>
                <div class="flex-1 flex flex-col items-center gap-2">
                    <div class="flex items-center gap-4">
                        <button id="previous-btn" class="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white" title="上一首">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                        </button>
                        <button id="play-pause-btn" class="play-button">
                            ${isPlaying ? 
                                '<svg class="w-6 h-6 fill-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>' :
                                '<svg class="w-6 h-6 fill-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'
                            }
                        </button>
                        <button id="next-btn" class="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white" title="下一首">
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
                    <button id="strategy-btn" class="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full hover:from-purple-500/30 hover:to-pink-500/30 transition-colors border border-purple-500/30 text-xs text-purple-200" title="播放模式">
                        <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
                        <span>${getPlaybackStrategyLabel()}</span>
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
            sendBtn.addEventListener('click', sendAIMessage);
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendAIMessage();
            });
        }

        document.querySelectorAll('[data-netease-playlist-id]').forEach(el => {
            el.addEventListener('click', () => {
                selectNeteasePlaylist(el.dataset.neteasePlaylistId);
            });
        });

        document.querySelectorAll('[data-local-playlist-index]').forEach(el => {
            el.addEventListener('click', () => {
                const index = Number(el.dataset.localPlaylistIndex);
                const playlist = getLibraryPlaylists().filter(item => item.isLocal)[index];
                if (!playlist) return;

                selectedPlaylist = playlist;
                if (!tracks.some(track => track.filePath && track.filePath.startsWith(playlist.path))) {
                    sendToCSharp('scanFolder', JSON.stringify({ Path: playlist.path }));
                }
                render();
            });
        });

        const saveNeteaseApiBtn = document.getElementById('save-netease-api-btn');
        if (saveNeteaseApiBtn) {
            saveNeteaseApiBtn.addEventListener('click', () => {
                const url = document.getElementById('netease-api-url')?.value.trim();
                if (url) {
                    sendToCSharp('setNeteaseApiBaseUrl', JSON.stringify({ apiBaseUrl: url }));
                }
            });
        }

        const neteaseQrLoginBtn = document.getElementById('netease-qr-login-btn');
        if (neteaseQrLoginBtn) {
            neteaseQrLoginBtn.addEventListener('click', () => {
                const url = document.getElementById('netease-api-url')?.value.trim();
                if (url) {
                    sendToCSharp('setNeteaseApiBaseUrl', JSON.stringify({ apiBaseUrl: url }));
                }
                sendToCSharp('neteaseQrStart');
            });
        }

        const cancelNeteaseQrBtn = document.getElementById('cancel-netease-qr-btn');
        if (cancelNeteaseQrBtn) {
            cancelNeteaseQrBtn.addEventListener('click', () => {
                stopNeteaseQrPoll();
                neteaseQrImage = '';
                updateNeteaseQrPanel();
            });
        }

        const syncNeteaseBtn = document.getElementById('sync-netease-btn');
        if (syncNeteaseBtn) {
            syncNeteaseBtn.addEventListener('click', () => {
                isNeteaseSyncing = true;
                render();
                sendToCSharp('syncNetease');
            });
        }

        const librarySyncNeteaseBtn = document.getElementById('library-sync-netease-btn');
        if (librarySyncNeteaseBtn) {
            librarySyncNeteaseBtn.addEventListener('click', () => {
                isNeteaseSyncing = true;
                render();
                sendToCSharp('syncNetease');
            });
        }

        const neteaseLogoutBtn = document.getElementById('netease-logout-btn');
        if (neteaseLogoutBtn) {
            neteaseLogoutBtn.addEventListener('click', () => {
                stopNeteaseQrPoll();
                sendToCSharp('neteaseLogout');
            });
        }

        document.querySelectorAll('[data-visible-track-index]').forEach(el => {
            el.addEventListener('click', () => {
                playVisibleTrack(Number(el.dataset.visibleTrackIndex));
            });
        });

        document.querySelectorAll('[data-empty-manual-play]').forEach(el => {
            el.addEventListener('click', promptAndPlayFile);
        });

        document.querySelectorAll('[data-rescan-empty-library]').forEach(el => {
            el.addEventListener('click', scanAllLocalPaths);
        });

        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', () => {
                settings.theme = normalizeTheme(btn.dataset.theme);
                applyTheme();
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

        const saveAIConfigBtn = document.getElementById('save-ai-config-btn');
        if (saveAIConfigBtn) {
            saveAIConfigBtn.addEventListener('click', () => {
                aiConfig.baseUrl = document.getElementById('ai-base-url')?.value.trim() || aiConfig.baseUrl;
                aiConfig.apiKey = document.getElementById('ai-api-key')?.value.trim() || '';
                aiConfig.model = document.getElementById('ai-model')?.value.trim() || aiConfig.model;
                saveAIConfig();
                aiState.error = null;
                alert('AI 设置已保存。');
            });
        }

        document.querySelectorAll('[data-mood]').forEach(card => {
            card.addEventListener('click', () => {
                currentView = 'ai-recommend';
                render();
                const input = document.getElementById('chat-input');
                if (input) {
                    input.value = `Recommend ${card.dataset.mood} music`;
                    sendAIMessage();
                }
            });
        });

        const addPathBtn = document.getElementById('add-path-btn');
        if (addPathBtn) {
            addPathBtn.addEventListener('click', () => {
                const path = prompt('请输入音乐文件夹路径：');
                const normalizedPath = path ? path.trim() : '';
                if (normalizedPath) {
                    sendToCSharp('addLocalPath', JSON.stringify({ Path: normalizedPath }));
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
                scanAllLocalPaths();
            });
        }

        attachPlayerEvents();
    }

    function attachPlayerEvents() {
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                if (isPlaying) {
                    savePlaybackState(currentTime, true);
                    isPlaying = false;
                    sendToCSharp('pause');
                } else if (currentFilePath) {
                    isPlaying = true;
                    sendToCSharp('resume');
                } else if (getPlayableQueue().length > 0) {
                    playTrackFromQueue(0);
                } else if (localPaths.length > 0) {
                    scanAllLocalPaths();
                } else {
                    promptAndPlayFile();
                }
                renderPlayer();
            });
        }

        const previousBtn = document.getElementById('previous-btn');
        if (previousBtn) {
            previousBtn.addEventListener('click', () => {
                savePlaybackState(currentTime, true);
                sendToCSharp('previous');
            });
        }

        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                savePlaybackState(currentTime, true);
                sendToCSharp('next');
            });
        }

        const strategyBtn = document.getElementById('strategy-btn');
        if (strategyBtn) {
            strategyBtn.addEventListener('click', cyclePlaybackStrategy);
        }

        const progressSlider = document.getElementById('progress-slider');
        if (progressSlider) {
            progressSlider.addEventListener('input', (e) => {
                progress = parseFloat(e.target.value);
                currentTime = (progress / 100) * duration;
                sendToCSharp('setProgress', progress.toString());
                savePlaybackState(currentTime, true);
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

    async function sendAIMessage() {
        const input = document.getElementById('chat-input');
        if (!input || !input.value.trim() || aiState.isLoading) return;
        const content = input.value.trim();

        const newMessage = {
            id: Date.now().toString(),
            type: 'user',
            content,
            timestamp: new Date()
        };
        messages.push(newMessage);
        input.value = '';
        aiState = { isLoading: true, error: null };
        aiRecommendedTracks = recommendLocalTracks(content);
        render();
        scrollChatToBottom();

        try {
            const responseText = await requestAIMessage(content);
            messages.push({
                id: (Date.now() + 1).toString(),
                type: 'ai',
                content: responseText,
                timestamp: new Date()
            });
        } catch (error) {
            messages.push({
                id: (Date.now() + 1).toString(),
                type: 'ai',
                content: buildLocalRecommendationText(content, aiRecommendedTracks),
                timestamp: new Date()
            });
            aiState.error = error instanceof Error ? error.message : 'AI service is unavailable.';
        } finally {
            aiState.isLoading = false;
            render();
            scrollChatToBottom();
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
        scrollChatToBottom();

        setTimeout(() => {
            const aiResponse = {
                id: (Date.now() + 1).toString(),
                type: 'ai',
                content: 'Okay, let me recommend music that fits your mood...',
                timestamp: new Date()
            };
            messages.push(aiResponse);
            render();
            scrollChatToBottom();
        }, 1000);
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
