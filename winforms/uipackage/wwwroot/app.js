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
    let isImmersivePlayerOpen = false;
    let windowDisplayState = 'normal';
    let lastImmersiveLyricIndex = -1;
    let immersiveControlsHideTimer = null;
    let currentImmersivePaletteKey = '';
    let immersivePaletteCache = new Map();
    let listeningBufferSeconds = 0;
    let lastProgressFilePath = '';
    let lastProgressTime = 0;
    let lastProgressWasPlaying = false;
    let hasLoadedLocalPaths = false;
    let hasAutoRestoredPlayback = false;
    let pendingRestoreTime = 0;
    let lastPlaybackStateSavedAt = 0;
    let isAutoAdvancing = false;
    let activePlaybackQueue = [];
    let activePlaybackPlaylist = null;
    let lyrics = [{ text: 'No lyrics loaded', time: 0 }];
    let aiConfig = loadAIConfig();
    let aiState = { isLoading: false, error: null };
    let aiRecommendedTracks = [];
    let aiRecommendationPlaylistName = 'AI Recommendations';
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
    let neteaseTopCharts = [];
    let neteaseMoodTags = [];
    let listeningInsights = null;
    let isLoadingNeteaseTopCharts = false;
    let isLoadingNeteaseMoodTags = false;
    let isLoadingExploreTracks = false;
    let startListeningState = { isLoading: false, error: '' };
    let lastAssistantPlaybackContext = null;
    let messageSequence = 0;
    let shouldScrollLibraryTrackList = false;
    const pendingRequests = new Map();
    const aiSystemPrompt = [
        'You are an AI music assistant for MusicAgent.',
        'Help users discover music based on mood, preferences, and listening habits.',
        'Keep responses concise, friendly, and music-focused.',
        'When recommending, mention specific songs or artists when possible.',
        'The current playback state supplied by MusicAgent is the source of truth; never infer the now-playing song from earlier chat messages.'
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
        window.addEventListener('keydown', handleGlobalKeyDown);
        loadInitialData();
        applyTheme();
        render();
        startProgressTimer();
        window.addEventListener('resize', () => {
            if (currentView === 'ai-recommend') {
                updateLyricsPadding();
            }
            if (isImmersivePlayerOpen) {
                updateImmersiveLyricsPadding();
            }
        });
    }

    function handleGlobalKeyDown(event) {
        if (event.key === 'Escape' && isImmersivePlayerOpen) {
            closeImmersivePlayer();
        }
    }

    function handleWebMessage(event) {
        const response = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        const action = response.action || response.Action;
        const data = response.data ?? response.Data;
        const id = response.id || response.Id;
        console.log('Received from C#:', response);
        resolvePendingRequest(id, action, data, response);
        
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
            case 'getListeningInsights':
                applyListeningInsights(data);
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
                if (action === 'setNeteaseApiBaseUrl') {
                    reloadNeteaseExploreData();
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
            case 'getNeteaseTopCharts':
                applyNeteaseTopCharts(data);
                break;
            case 'getNeteaseMoodTags':
                applyNeteaseMoodTags(data);
                break;
            case 'getNeteaseExploreTracks':
            case 'getNeteaseMoodTracks':
                applyNeteaseExploreTracks(data);
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

    function scrollLibraryTrackListIntoView(behavior = 'smooth') {
        shouldScrollLibraryTrackList = true;
        requestAnimationFrame(() => {
            const scroller = getMainScrollEl();
            const target = document.getElementById('library-track-list');
            if (!scroller || !target || currentView !== 'library') return;

            shouldScrollLibraryTrackList = false;
            scroller.scrollTo({
                top: Math.max(target.offsetTop - 16, 0),
                behavior
            });
        });
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
            if (currentView === 'library') scrollLibraryTrackListIntoView('auto');
            return;
        }

        neteaseTracks = Array.isArray(payload?.tracks) ? payload.tracks.map(normalizeTrack) : [];
        if (neteaseTracks.length > 0 && !neteaseTracks.some(t => String(t.coverUrl || '').trim())) {
            console.warn('曲目缺少封面，请在设置中重新「同步网易云」。');
        }
        render();
        if (currentView === 'library') scrollLibraryTrackListIntoView('auto');

        if (neteaseTracks.length === 0) {
            alert(payload?.message || '该歌单暂无曲目，请重新同步网易云数据。');
            return;
        }
    }

    function applyNeteaseTopCharts(data) {
        isLoadingNeteaseTopCharts = false;
        const payload = parseJsonData(data);
        if (payload?.errorMessage || payload?.success === false) {
            console.warn('NetEase charts failed:', payload?.errorMessage || payload?.message || data);
            if (currentView === 'explore') render();
            return;
        }

        neteaseTopCharts = Array.isArray(payload?.charts)
            ? payload.charts.map(normalizeNeteaseChart).filter(chart => chart.playlistId)
            : [];
        if (currentView === 'explore') render();
    }

    function applyNeteaseMoodTags(data) {
        isLoadingNeteaseMoodTags = false;
        const payload = parseJsonData(data);
        if (payload?.errorMessage || payload?.success === false) {
            console.warn('NetEase mood tags failed:', payload?.errorMessage || payload?.message || data);
            if (currentView === 'explore') render();
            return;
        }

        neteaseMoodTags = Array.isArray(payload?.tags)
            ? payload.tags.map(normalizeNeteaseMoodTag).filter(tag => tag.name)
            : [];
        if (currentView === 'explore') render();
    }

    function applyNeteaseExploreTracks(data) {
        isLoadingExploreTracks = false;
        const payload = parseJsonData(data);
        if (payload?.errorMessage || payload?.success === false) {
            const message = payload?.errorMessage || payload?.message || '网易云曲目加载失败';
            startListeningState = { isLoading: false, error: message };
            render();
            return;
        }

        if (currentView === 'explore' || currentView === 'ai-recommend') {
            render();
        }
    }

    function applyListeningInsights(data) {
        const payload = parseJsonData(data);
        if (!payload || payload.success === false) {
            console.warn('Listening insights failed:', payload?.errorMessage || data);
            return;
        }

        listeningInsights = payload;
    }

    function normalizeNeteaseChart(chart) {
        const tracks = chart.tracks ?? chart.Tracks ?? [];
        return {
            playlistId: chart.playlistId ?? chart.PlaylistId ?? chart.id ?? chart.Id,
            name: chart.name ?? chart.Name ?? '网易云榜单',
            description: chart.description ?? chart.Description ?? '',
            coverUrl: chart.coverUrl ?? chart.CoverUrl ?? '',
            trackCount: Number(chart.trackCount ?? chart.TrackCount ?? 0),
            updateFrequency: chart.updateFrequency ?? chart.UpdateFrequency ?? '',
            tracks: Array.isArray(tracks)
                ? tracks.map(track => ({
                    title: track.title ?? track.Title ?? '',
                    artist: track.artist ?? track.Artist ?? ''
                })).filter(track => track.title)
                : []
        };
    }

    function normalizeNeteaseMoodTag(tag) {
        return {
            name: tag.name ?? tag.Name ?? '',
            category: tag.category ?? tag.Category ?? '',
            hot: Boolean(tag.hot ?? tag.Hot),
            source: tag.source ?? tag.Source ?? ''
        };
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
        updateImmersivePlayer();

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
                    selectedPlaylist = getLibraryPlaylists().find(playlist => playlist.isLocal && playlist.path === scannedPath) || selectedPlaylist;
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
        if (currentView === 'library' && selectedPlaylist?.isLocal && scannedPath && selectedPlaylist.path === scannedPath) {
            shouldScrollLibraryTrackList = true;
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
        if (selectedPlaylist?.isExploreChart) return;
        if (libraryPlaylists.length === 0) {
            selectedPlaylist = null;
            return;
        }

        if (selectedPlaylist?.isAIRecommendation) {
            selectedPlaylist = libraryPlaylists.find(playlist => playlist.isAIRecommendation) || libraryPlaylists[0];
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

    function getAIRecommendationPlaylist() {
        const recommendationTracks = uniqueTracks(aiRecommendedTracks).slice(0, 5);
        if (recommendationTracks.length === 0) return null;

        return {
            id: 'ai-recommendations',
            isLocal: false,
            isNetease: false,
            isAIRecommendation: true,
            name: aiRecommendationPlaylistName || 'AI Recommendations',
            tracks: recommendationTracks.length,
            duration: 'AI 推荐',
            cover: getTrackCover(recommendationTracks[0]),
            path: ''
        };
    }

    function selectAIRecommendationPlaylist() {
        const playlist = getAIRecommendationPlaylist();
        if (playlist) selectedPlaylist = playlist;
        return playlist;
    }

    function setAIRecommendations(trackList, playlistName = 'AI Recommendations') {
        aiRecommendedTracks = uniqueTracks(trackList).slice(0, 5);
        aiRecommendationPlaylistName = playlistName || 'AI Recommendations';
        const playlist = selectAIRecommendationPlaylist();
        if (!playlist && selectedPlaylist?.isAIRecommendation) {
            selectedPlaylist = getLibraryPlaylists()[0] || null;
        }
        return playlist;
    }

    function getLibraryPlaylists() {
        const aiRecommendationPlaylist = getAIRecommendationPlaylist();
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
        return [
            ...(aiRecommendationPlaylist ? [aiRecommendationPlaylist] : []),
            ...cloud,
            ...local
        ];
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
        if (selectedPlaylist?.isAIRecommendation) {
            return aiRecommendedTracks;
        }
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
        scrollLibraryTrackListIntoView();
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

    function isMeaningfulTrackTitle(value) {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized && normalized !== 'unknown track' && normalized !== 'no track selected';
    }

    function isMeaningfulArtist(value) {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized && normalized !== 'unknown artist' && normalized !== 'choose a track';
    }

    function getTrackSource(track) {
        return track?.sourceUri || track?.filePath || '';
    }

    function isNeteaseSource(source) {
        return String(source || '').startsWith('netease:');
    }

    function findTrackBySource(source) {
        const normalizedSource = normalizePathForCompare(source);
        if (!normalizedSource) return null;

        return [...aiRecommendedTracks, ...neteaseTracks, ...tracks]
            .map(normalizeTrack)
            .find(track => {
                const trackSource = getTrackSource(track);
                return normalizePathForCompare(trackSource) === normalizedSource;
            }) || null;
    }

    function getNowPlayingSnapshot() {
        const source = currentSourceUri || currentFilePath;
        const knownTrack = findTrackBySource(source);
        const queueTrack = findActiveQueueTrackBySource(source);
        const title = isMeaningfulTrackTitle(currentTrackTitle)
            ? currentTrackTitle
            : (knownTrack?.title || queueTrack?.title || (source ? getFileNameWithoutExtension(source) : ''));
        const artist = isMeaningfulArtist(currentTrackArtist)
            ? currentTrackArtist
            : (knownTrack?.artist || queueTrack?.artist || 'Unknown Artist');
        const hasTrack = Boolean(source || isMeaningfulTrackTitle(title));
        const track = hasTrack
            ? normalizeTrack({
                id: knownTrack?.id || queueTrack?.id || source || title,
                songId: knownTrack?.songId || queueTrack?.songId || parseNeteaseSongId(source),
                isNetease: knownTrack?.isNetease || queueTrack?.isNetease || isNeteaseSource(source),
                title,
                artist,
                album: knownTrack?.album || queueTrack?.album || (isNeteaseSource(source) ? '网易云音乐' : 'Local Music'),
                duration: duration ? formatTime(duration) : (knownTrack?.duration || queueTrack?.duration || '--:--'),
                durationMs: duration ? duration * 1000 : (knownTrack?.durationMs || queueTrack?.durationMs || null),
                coverUrl: currentCoverUrl || knownTrack?.coverUrl || queueTrack?.coverUrl || '',
                filePath: isNeteaseSource(source) ? '' : source,
                sourceUri: source
            })
            : null;

        return {
            hasTrack,
            track,
            sourceUri: source,
            title,
            artist,
            isPlaying,
            currentTime,
            duration,
            volume
        };
    }

    function getPlaybackContextForAI() {
        const snapshot = getNowPlayingSnapshot();
        if (!snapshot.hasTrack || !snapshot.track) {
            return 'Current actual playback: no song is selected in the player.';
        }

        const status = snapshot.isPlaying ? 'playing' : 'paused';
        const progressText = snapshot.duration > 0
            ? `${formatTime(snapshot.currentTime)} / ${formatTime(snapshot.duration)}`
            : `${formatTime(snapshot.currentTime)}`;
        return [
            `Current actual playback (${status}): ${snapshot.track.title} - ${snapshot.track.artist}.`,
            `Source: ${snapshot.track.isNetease ? 'NetEase Cloud Music' : 'Local Music Library'} (${snapshot.sourceUri || 'unknown source'}).`,
            `Volume: ${snapshot.volume}%. Progress: ${progressText}.`,
            'If the user asks what is playing or why this song is playing, answer with this exact song and explain from this state.'
        ].join('\n');
    }

    function getChatContext() {
        const localTrackHints = tracks
            .slice(0, 20)
            .map(track => `${track.title || getFileNameWithoutExtension(track.filePath || '')} - ${track.artist || 'Unknown Artist'}`)
            .join('\n');

        const libraryText = localTrackHints
            ? `Local library candidates:\n${localTrackHints}`
            : 'The local library is empty or still scanning.';
        return `${getPlaybackContextForAI()}\n\n${libraryText}`;
    }

    function getAIConversationMessages(userContent) {
        const latestUserContent = String(userContent || '').trim();
        const recentMessages = messages
            .slice(-8)
            .filter(msg => msg.content && msg.type !== 'system')
            .map(msg => ({
                role: msg.type === 'user' ? 'user' : 'assistant',
                content: msg.content
            }));
        const lastMessage = recentMessages[recentMessages.length - 1];
        const shouldAppendLatest =
            latestUserContent &&
            (!lastMessage || lastMessage.role !== 'user' || lastMessage.content !== latestUserContent);

        return [
            { role: 'system', content: `${aiSystemPrompt}\n${getChatContext()}` },
            ...recentMessages,
            ...(shouldAppendLatest ? [{ role: 'user', content: latestUserContent }] : [])
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
        if (isImmersivePlayerOpen) {
            renderImmersiveLyricsPanel();
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
        if (isImmersivePlayerOpen) {
            renderImmersiveLyricsPanel();
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
        return /^(ti|ar|al|by|offset|id|ve|key|hash|sign|qq|total)\s*:/i.test(text)
            || /^(作词|作曲|编曲|制作人|制作|监制|录音|混音|母带|和声|吉他|贝斯|鼓|键盘|钢琴|弦乐|人声|配唱|出品|发行|词曲|原唱|翻唱|OP|SP|ISRC|企划|统筹|封面|设计)\s*[:：]/i.test(text);
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

    function nextMessageId() {
        messageSequence += 1;
        return `${Date.now()}-${messageSequence}`;
    }

    function postToCSharp(message) {
        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.postMessage(JSON.stringify(message));
        } else {
            console.log('Mock message to C#:', message);
        }
    }

    function sendToCSharp(action, data = '') {
        postToCSharp({ id: nextMessageId(), action, data });
    }

    function requestFromCSharp(action, data = '', timeoutMs = 30000) {
        if (!(window.chrome && window.chrome.webview)) {
            return Promise.reject(new Error('Desktop WebView bridge is unavailable.'));
        }

        const id = nextMessageId();
        const message = { id, action, data };
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                pendingRequests.delete(id);
                reject(new Error(`${action} timed out.`));
            }, timeoutMs);

            pendingRequests.set(id, { resolve, reject, timer });
            postToCSharp(message);
        });
    }

    function resolvePendingRequest(id, action, data, response) {
        if (!id || !pendingRequests.has(id)) return;

        const pending = pendingRequests.get(id);
        pendingRequests.delete(id);
        clearTimeout(pending.timer);
        pending.resolve({ action, data, response });
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
            lastPlaybackTime: Number(source.lastPlaybackTime ?? source.LastPlaybackTime ?? settings.lastPlaybackTime ?? 0) || 0,
            lastPlaybackQueue: parseSavedJson(source.lastPlaybackQueueJson ?? source.LastPlaybackQueueJson, []),
            lastPlaybackQueueIndex: Number(source.lastPlaybackQueueIndex ?? source.LastPlaybackQueueIndex ?? -1),
            lastPlaybackPlaylist: parseSavedJson(source.lastPlaybackPlaylistJson ?? source.LastPlaybackPlaylistJson, null),
            lastPlaybackQueueJson: source.lastPlaybackQueueJson ?? source.LastPlaybackQueueJson ?? '',
            lastPlaybackPlaylistJson: source.lastPlaybackPlaylistJson ?? source.LastPlaybackPlaylistJson ?? ''
        };
    }

    function parseSavedJson(value, fallback) {
        if (!value || typeof value !== 'string') return fallback;
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
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

    function restoreSavedPlaylistContext(savedPlaylist, savedQueue) {
        if (!savedPlaylist || typeof savedPlaylist !== 'object') return;

        if (savedPlaylist.type === 'netease') {
            const playlist = findNeteasePlaylistById(savedPlaylist.externalId);
            selectedPlaylist = playlist || {
                id: `netease-${savedPlaylist.externalId}`,
                name: savedPlaylist.name || '网易云歌单',
                isNetease: true,
                externalId: savedPlaylist.externalId,
                cover: savedPlaylist.cover || savedPlaylist.coverUrl || getDefaultCover()
            };
            neteaseTracks = savedQueue.map(normalizeTrack);
            return;
        }

        if (savedPlaylist.type === 'ai') {
            selectedPlaylist = {
                id: 'ai-recommendations',
                name: savedPlaylist.name || aiRecommendationPlaylistName,
                isAIRecommendation: true
            };
            aiRecommendedTracks = savedQueue.map(normalizeTrack);
            return;
        }

        if (savedPlaylist.type === 'local' && savedPlaylist.path) {
            selectedPlaylist = getLibraryPlaylists().find(item =>
                item.isLocal && item.path === savedPlaylist.path
            ) || selectedPlaylist;
        }
    }

    function tryRestoreSavedQueue() {
        const savedQueue = Array.isArray(settings.lastPlaybackQueue)
            ? settings.lastPlaybackQueue.map(normalizeTrack).filter(track => getTrackSource(track))
            : [];
        if (savedQueue.length === 0) return false;

        const savedSource = settings.lastTrackPath;
        const savedIndex = Number.isFinite(settings.lastPlaybackQueueIndex)
            ? settings.lastPlaybackQueueIndex
            : -1;
        const sourceIndex = savedQueue.findIndex(track =>
            normalizePathForCompare(getTrackSource(track)) === normalizePathForCompare(savedSource)
        );
        const queueIndex = Math.min(
            Math.max(sourceIndex >= 0 ? sourceIndex : savedIndex, 0),
            savedQueue.length - 1
        );
        const selected = savedQueue[queueIndex];
        if (!selected) return false;

        restoreSavedPlaylistContext(settings.lastPlaybackPlaylist, savedQueue);
        activePlaybackQueue = getPlayableQueue(savedQueue);
        if (activePlaybackQueue.length > 0) {
            activePlaybackQueue = activePlaybackQueue.map(queueTrack => {
                const savedTrack = savedQueue.find(track =>
                    normalizePathForCompare(getTrackSource(track)) === normalizePathForCompare(queueTrack.sourceUri)
                );
                return savedTrack ? { ...queueTrack, ...normalizeTrack(savedTrack), sourceUri: queueTrack.sourceUri } : queueTrack;
            });
        }
        activePlaybackPlaylist = settings.lastPlaybackPlaylist || null;
        pendingRestoreTime = Math.max(0, Number(settings.lastPlaybackTime) || 0);
        hasAutoRestoredPlayback = true;

        currentFilePath = getTrackSource(selected);
        currentSourceUri = getTrackSource(selected);
        currentTrackTitle = selected.title;
        currentTrackArtist = selected.artist;
        currentCoverUrl = getTrackCover(selected);
        currentQueueIndex = queueIndex;
        isPlaying = true;
        requestLyricsForSource(currentSourceUri);

        sendToCSharp('setQueue', JSON.stringify({
            tracks: activePlaybackQueue,
            startIndex: queueIndex,
            autoPlay: true
        }));
        renderPlayer();
        return true;
    }

    function tryAutoRestorePlayback() {
        if (hasAutoRestoredPlayback || !settings.autoPlay || !settings.lastTrackPath) return;
        if (!hasLoadedLocalPaths) return;

        if (tryRestoreSavedQueue()) return;

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
        settings.lastPlaybackQueue = activePlaybackQueue;
        settings.lastPlaybackQueueIndex = currentQueueIndex;
        settings.lastPlaybackPlaylist = activePlaybackPlaylist;
        settings.lastPlaybackQueueJson = JSON.stringify(activePlaybackQueue);
        settings.lastPlaybackPlaylistJson = JSON.stringify(activePlaybackPlaylist);
        sendToCSharp('savePlaybackState', JSON.stringify({
            lastTrackPath: settings.lastTrackPath,
            lastPlaybackTime: settings.lastPlaybackTime,
            lastPlaybackQueueJson: settings.lastPlaybackQueueJson,
            lastPlaybackQueueIndex: currentQueueIndex,
            lastPlaybackPlaylistJson: settings.lastPlaybackPlaylistJson
        }));
    }

    function maybeSavePlaybackState() {
        if (!isPlaying) return;
        savePlaybackState(currentTime);
    }

    function reloadNeteaseExploreData() {
        neteaseTopCharts = [];
        neteaseMoodTags = [];
        isLoadingNeteaseTopCharts = true;
        isLoadingNeteaseMoodTags = true;
        sendToCSharp('getNeteaseTopCharts');
        sendToCSharp('getNeteaseMoodTags');
    }

    function loadInitialData() {
        sendToCSharp('getWeeklyData');
        sendToCSharp('getPlatformData');
        sendToCSharp('getLocalPaths');
        sendToCSharp('getSettings');
        sendToCSharp('getNeteaseStatus');
        reloadNeteaseExploreData();
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
        rememberPlaybackQueue([{ id: filePath, title, artist, sourceUri: filePath, coverUrl: currentCoverUrl || '' }], 0, null);
        requestLyricsForSource(filePath);
        if (!options.skipSave) savePlaybackState(0, true);
        sendToCSharp('play', JSON.stringify({ filePath, title, artist, coverUrl: currentCoverUrl || '' }));
        renderPlayer();
    }

    function toQueueTrack(track, index) {
        const normalized = normalizeTrack(track);
        const sourceUri = normalized.sourceUri || normalized.filePath || '';
        return {
            id: String(normalized.id || sourceUri || `track-${index}`),
            songId: normalized.songId || parseNeteaseSongId(sourceUri),
            isNetease: Boolean(normalized.isNetease || isNeteaseSource(sourceUri)),
            title: normalized.title || getFileNameWithoutExtension(sourceUri),
            artist: normalized.artist || 'Unknown Artist',
            album: normalized.album || (isNeteaseSource(sourceUri) ? '网易云音乐' : 'Local Music'),
            sourceUri,
            coverUrl: normalized.coverUrl || '',
            duration: normalized.duration || '--:--',
            durationMs: normalized.durationMs || null
        };
    }

    function capturePlaylistContext() {
        if (selectedPlaylist?.isNetease) {
            return {
                type: 'netease',
                externalId: selectedPlaylist.externalId,
                name: selectedPlaylist.name,
                cover: selectedPlaylist.cover
            };
        }

        if (selectedPlaylist?.isAIRecommendation) {
            return {
                type: 'ai',
                name: selectedPlaylist.name || aiRecommendationPlaylistName
            };
        }

        if (selectedPlaylist?.isLocal) {
            return {
                type: 'local',
                path: selectedPlaylist.path,
                name: selectedPlaylist.name
            };
        }

        return null;
    }

    function rememberPlaybackQueue(queue, queueIndex, playlistContext = capturePlaylistContext()) {
        activePlaybackQueue = Array.isArray(queue) ? queue.map(toQueueTrack).filter(track => track.sourceUri) : [];
        currentQueueIndex = Number.isFinite(Number(queueIndex)) ? Number(queueIndex) : currentQueueIndex;
        activePlaybackPlaylist = playlistContext;
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
        rememberPlaybackQueue(queue, startIndex >= 0 ? startIndex : index);

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

    function uniqueTracks(trackList) {
        const seen = new Set();
        const result = [];
        trackList.forEach(track => {
            const normalized = normalizeTrack(track);
            const source = normalized.sourceUri || normalized.filePath;
            if (!source) return;

            const key = normalizePathForCompare(source);
            if (seen.has(key)) return;

            seen.add(key);
            result.push(normalized);
        });
        return result;
    }

    function playTrackCollection(trackList, startIndex = 0, options = {}) {
        const normalizedTracks = uniqueTracks(trackList);
        const queue = getPlayableQueue(normalizedTracks);
        if (queue.length === 0) return false;

        const queueIndex = Math.min(Math.max(startIndex, 0), queue.length - 1);
        const selectedSource = queue[queueIndex].sourceUri;
        const selected = normalizedTracks.find(track => (track.sourceUri || track.filePath) === selectedSource) || normalizedTracks[queueIndex];
        if (!selected) return false;

        if (options.detachPlaylist) {
            selectedPlaylist = null;
        }

        currentFilePath = selectedSource;
        currentSourceUri = selectedSource;
        currentTrackTitle = selected.title;
        currentTrackArtist = selected.artist;
        currentCoverUrl = getTrackCover(selected);
        currentQueueIndex = queueIndex;
        isPlaying = true;
        rememberPlaybackQueue(queue, queueIndex);

        requestLyricsForSource(currentSourceUri);
        if (!options.skipSave) savePlaybackState(0, true);

        sendToCSharp('setQueue', JSON.stringify({
            tracks: queue,
            startIndex: queueIndex,
            autoPlay: true
        }));
        renderPlayer();
        return true;
    }

    async function playTrackCollectionConfirmed(trackList, startIndex = 0, options = {}) {
        const normalizedTracks = uniqueTracks(trackList);
        const queue = getPlayableQueue(normalizedTracks);
        if (queue.length === 0) {
            throw new Error('没有可播放的音频源。');
        }

        const queueIndex = Math.min(Math.max(startIndex, 0), queue.length - 1);
        const selectedSource = queue[queueIndex].sourceUri;
        const selected = normalizedTracks.find(track => getTrackSource(track) === selectedSource) || normalizedTracks[queueIndex];
        if (!selected) {
            throw new Error('没有找到要播放的歌曲。');
        }

        if (options.detachPlaylist) {
            selectedPlaylist = null;
        }

        const payload = await requestJsonFromCSharp('setQueue', JSON.stringify({
            tracks: queue,
            startIndex: queueIndex,
            autoPlay: true
        }), options.timeoutMs || 90000);
        rememberPlaybackQueue(queue, queueIndex);

        currentFilePath = selectedSource;
        currentSourceUri = selectedSource;
        currentTrackTitle = payload.title || selected.title;
        currentTrackArtist = payload.artist || selected.artist;
        currentCoverUrl = payload.coverUrl || getTrackCover(selected);
        currentQueueIndex = Number.isFinite(Number(payload.currentIndex)) ? Number(payload.currentIndex) : queueIndex;
        isPlaying = Boolean(payload.isPlaying ?? true);
        requestLyricsForSource(selectedSource);
        if (!options.skipSave) savePlaybackState(0, true);
        renderPlayer();

        return {
            state: payload,
            track: normalizeTrack({
                ...selected,
                title: payload.title || selected.title,
                artist: payload.artist || selected.artist,
                coverUrl: payload.coverUrl || selected.coverUrl,
                sourceUri: payload.logicalSourceUri || payload.trackId || selectedSource
            })
        };
    }

    async function requestJsonFromCSharp(action, data = '', timeoutMs = 30000) {
        const result = await requestFromCSharp(action, data, timeoutMs);
        const payload = parseJsonData(result.data);
        if (!payload || typeof payload !== 'object') {
            throw new Error(`${action} returned an empty response.`);
        }
        if (payload.errorMessage || payload.success === false) {
            throw new Error(payload.errorMessage || payload.message || `${action} failed.`);
        }
        return payload;
    }

    async function ensureNeteaseCharts() {
        if (neteaseTopCharts.length > 0) return neteaseTopCharts;

        isLoadingNeteaseTopCharts = true;
        if (currentView === 'explore') render();
        const payload = await requestJsonFromCSharp('getNeteaseTopCharts', '', 30000);
        neteaseTopCharts = Array.isArray(payload.charts)
            ? payload.charts.map(normalizeNeteaseChart).filter(chart => chart.playlistId)
            : [];
        isLoadingNeteaseTopCharts = false;
        return neteaseTopCharts;
    }

    function chooseStarterChart() {
        return neteaseTopCharts.find(chart => chart.name.includes('热歌')) || neteaseTopCharts[0] || null;
    }

    async function fetchNeteaseChartTracks(playlistId, title, source = 'explore', options = {}) {
        const request = {
            playlistId: String(playlistId),
            title,
            source,
            limit: options.limit ?? 40,
            includeAll: Boolean(options.includeAll)
        };
        const payload = await requestJsonFromCSharp('getNeteaseExploreTracks', JSON.stringify(request), 60000);
        return Array.isArray(payload.tracks) ? payload.tracks.map(normalizeTrack) : [];
    }

    async function openNeteaseChartInLibrary(playlistId, title) {
        if (!playlistId || isLoadingExploreTracks) return;

        isLoadingExploreTracks = true;
        render();
        try {
            const chartTracks = await fetchNeteaseChartTracks(playlistId, title, 'chart', { includeAll: true });
            if (chartTracks.length === 0) {
                throw new Error('该网易云榜单暂无曲目。');
            }

            const chart = neteaseTopCharts.find(item => String(item.playlistId) === String(playlistId));
            selectedPlaylist = {
                id: `netease-chart-${playlistId}`,
                externalId: String(playlistId),
                isLocal: false,
                isNetease: true,
                isExploreChart: true,
                name: title || chart?.name || '网易云热榜',
                tracks: chart?.trackCount || chartTracks.length,
                duration: '网易云榜单',
                cover: chart?.coverUrl || getTrackCover(chartTracks[0]),
                path: ''
            };
            neteaseTracks = chartTracks;
            currentView = 'library';
        } catch (error) {
            alert(error instanceof Error ? error.message : '网易云榜单加载失败。');
        } finally {
            isLoadingExploreTracks = false;
            render();
            if (currentView === 'library') scrollLibraryTrackListIntoView('auto');
        }
    }

    async function playNeteaseMood(tag) {
        if (!tag || isLoadingExploreTracks) return;

        currentView = 'ai-recommend';
        isLoadingExploreTracks = true;
        aiState = { isLoading: true, error: null };
        messages.push({
            id: Date.now().toString(),
            type: 'user',
            content: `推荐一些网易云「${tag}」氛围的音乐`,
            timestamp: new Date()
        });
        render();
        scrollChatToBottom();

        try {
            const payload = await requestJsonFromCSharp('getNeteaseMoodTracks', JSON.stringify({ tag, limit: 40 }), 60000);
            const moodTracks = Array.isArray(payload.tracks) ? payload.tracks.map(normalizeTrack) : [];
            if (moodTracks.length === 0) {
                throw new Error(payload.message || '该心情氛围暂无可播放曲目。');
            }

            const playlistTitle = payload.playlistName
                ? `AI推荐：${tag} · ${payload.playlistName}`
                : `AI推荐：${tag}`;
            setAIRecommendations(moodTracks, playlistTitle);
            const playback = await playTrackCollectionConfirmed(aiRecommendedTracks, 0);
            selectAIRecommendationPlaylist();
            setLastAssistantPlaybackContext(playback.track, `根据网易云「${tag}」氛围推荐`, tag);
            render();
            scrollChatToBottom();

            const prompt = buildRecommendationPlaylistPrompt(
                `请用简短中文为网易云「${tag}」氛围生成一组 AI 推荐歌单。`,
                aiRecommendedTracks,
                listeningInsights,
                { moodTag: tag }
            );
            const reason = await buildRecommendationPlaylistReason(
                prompt,
                aiRecommendedTracks,
                listeningInsights,
                `已从网易云「${tag}」氛围中选择歌曲`,
                { moodTag: tag }
            );
            messages.push({
                id: (Date.now() + 1).toString(),
                type: 'ai',
                content: reason,
                timestamp: new Date()
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : '网易云心情氛围加载失败。';
            aiState.error = message;
            messages.push({
                id: (Date.now() + 1).toString(),
                type: 'ai',
                content: message,
                timestamp: new Date()
            });
        } finally {
            isLoadingExploreTracks = false;
            aiState.isLoading = false;
            render();
            scrollChatToBottom();
        }
    }

    function getPlayableLocalTracks() {
        return tracks.filter(track => (track.filePath || track.sourceUri) && !track.isNetease);
    }

    function getInsightTopTracks() {
        const topTracks = listeningInsights?.topTracks ?? listeningInsights?.TopTracks ?? [];
        return Array.isArray(topTracks) ? topTracks : [];
    }

    function buildInsightNeteaseCandidates() {
        return getInsightTopTracks()
            .map(item => {
                const songId = item.songId ?? item.SongId;
                if (!songId || Number(songId) <= 0) return null;
                return normalizeTrack({
                    id: `netease-${songId}`,
                    songId,
                    isNetease: true,
                    title: item.title ?? item.Title ?? `网易云歌曲 ${songId}`,
                    artist: item.artist ?? item.Artist ?? '网易云历史记录',
                    album: 'Music Library 听歌数据',
                    sourceUri: `netease:${songId}`,
                    coverUrl: ''
                });
            })
            .filter(Boolean);
    }

    function rankLocalTracksByInsights(localTracks) {
        const topPaths = getInsightTopTracks().map(item => item.trackPath ?? item.TrackPath ?? '');
        return localTracks
            .map((track, index) => {
                const source = track.filePath || track.sourceUri || '';
                const insightIndex = topPaths.findIndex(path => normalizePathForCompare(path) === normalizePathForCompare(source));
                const score = insightIndex >= 0 ? 100 - insightIndex * 8 : Math.max(0, 20 - index);
                return { track, score };
            })
            .sort((a, b) => b.score - a.score)
            .map(item => item.track);
    }

    async function fetchStarterNeteaseTracks() {
        const insightCandidates = buildInsightNeteaseCandidates();
        let chartCandidates = [];
        try {
            await ensureNeteaseCharts();
            const chart = chooseStarterChart();
            if (chart) {
                chartCandidates = await fetchNeteaseChartTracks(chart.playlistId, chart.name, 'startListening');
            }
        } catch (error) {
            console.warn('Starter NetEase tracks unavailable:', error);
        }

        return uniqueTracks([...chartCandidates, ...insightCandidates]);
    }

    function chooseStartListeningTracks(localTracks, neteaseTracks) {
        const rankedLocalTracks = rankLocalTracksByInsights(localTracks);
        if (rankedLocalTracks.length > 0) {
            return uniqueTracks([
                rankedLocalTracks[0],
                ...neteaseTracks.slice(0, 3),
                ...rankedLocalTracks.slice(1, 3)
            ]).slice(0, 5);
        }

        return uniqueTracks(neteaseTracks).slice(0, 5);
    }

    function getPreferredPlatformText(insights) {
        const value = insights?.preferredPlatform ?? insights?.PreferredPlatform ?? '';
        return value ? formatPlatformName(value) : '';
    }

    function getPreferredTimeText(insights) {
        return insights?.preferredTimeBucket ?? insights?.PreferredTimeBucket ?? '';
    }

    function buildInsightSummary(insights, localCount, neteaseCount) {
        const parts = [];
        const platform = getPreferredPlatformText(insights);
        const timeBucket = getPreferredTimeText(insights);
        const totalHours = Number(insights?.totalHours ?? insights?.TotalHours ?? 0);

        if (platform) parts.push(`最近 7 天更常听 ${platform}`);
        if (timeBucket) parts.push(`常见听歌时段是 ${timeBucket}`);
        if (totalHours > 0) parts.push(`本周已记录 ${totalHours.toFixed(1)} 小时听歌`);
        if (localCount > 0) parts.push(`本地曲库有 ${localCount} 首可播放歌曲`);
        if (neteaseCount > 0) parts.push(`网易云补充了 ${neteaseCount} 首候选歌曲`);

        return parts.length > 0 ? parts.join('；') : '当前听歌数据还不多，因此优先选择可立即播放且风格稳定的歌曲';
    }

    function getTrackTitle(track) {
        return track?.title || 'Unknown Track';
    }

    function getTrackArtist(track) {
        return track?.artist || 'Unknown Artist';
    }

    function formatRecommendedTrack(track) {
        const title = getTrackTitle(track);
        const artist = getTrackArtist(track);
        return artist && artist !== 'Unknown Artist'
            ? `《${title}》 - ${artist}`
            : `《${title}》`;
    }

    function formatTrackForPrompt(track, index = 0) {
        const album = track?.album && track.album !== '网易云音乐' && track.album !== 'Local Music'
            ? ` / ${track.album}`
            : '';
        return `${index + 1}. ${getTrackTitle(track)} - ${getTrackArtist(track)}${album} (${track?.isNetease ? '网易云' : 'Local'})`;
    }

    function normalizeRecommendationText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[《》「」"'\s\-–—_:：/\\()（）[\]【】]/g, '');
    }

    function recommendationMentionsTrack(text, track) {
        const normalizedText = normalizeRecommendationText(text);
        const rawTitle = String(track?.title || '');
        const titleWithoutMix = rawTitle.replace(/\s*[\(（【\[].*?[\)）】\]]/g, '').trim();
        const titleNeedles = [rawTitle, titleWithoutMix]
            .map(normalizeRecommendationText)
            .filter(value => value && value !== normalizeRecommendationText('Unknown Track'));
        const needles = titleNeedles.length > 0
            ? titleNeedles
            : [track?.artist]
                .map(normalizeRecommendationText)
                .filter(value => value && value !== normalizeRecommendationText('Unknown Artist'));

        return needles.some(value => Array.from(value).length >= 2 && normalizedText.includes(value));
    }

    function buildRecommendationIntro(first, fallbackIntro) {
        const intro = String(fallbackIntro || '').trim().replace(/[。.!！?？]+$/, '');
        return intro
            ? `${intro}，先播放 ${formatRecommendedTrack(first)}。`
            : `我先为你播放 ${formatRecommendedTrack(first)}。`;
    }

    function buildRuleBasedRecommendationText(recommendedTracks, insights, fallbackIntro, options = {}) {
        const first = recommendedTracks[0];
        const insightText = buildInsightSummary(insights, getPlayableLocalTracks().length, recommendedTracks.filter(track => track.isNetease).length);
        if (!first) return fallbackIntro || '暂时没有可播放的推荐曲目。';

        const sourceText = first.isNetease ? '网易云推荐池' : 'Music Library';
        const moodText = options.moodTag ? `「${options.moodTag}」氛围` : '当前推荐场景';
        const albumText = first.album && first.album !== '网易云音乐' && first.album !== 'Local Music'
            ? `，专辑/歌单线索是「${first.album}」`
            : '';
        const queueHint = recommendedTracks.length > 1
            ? `后续队列还准备了 ${recommendedTracks.slice(1, 3).map(formatRecommendedTrack).join('、')}，会继续保持相近的听感。`
            : '我会先把这首作为本次推荐的开场。';

        return [
            buildRecommendationIntro(first, fallbackIntro),
            `推荐理由：这首歌来自${sourceText}${albumText}，和${moodText}匹配；${insightText}。`,
            queueHint
        ].join('\n');
    }

    function buildSingleTrackRecommendationReason(track, index, insights, options = {}) {
        const sourceText = track.isNetease ? '网易云推荐池' : 'Music Library';
        const moodText = options.moodTag ? `「${options.moodTag}」氛围` : '这次推荐';
        const albumText = track.album && track.album !== '网易云音乐' && track.album !== 'Local Music'
            ? `，专辑/歌单线索是「${track.album}」`
            : '';
        const roleHints = [
            '适合作为开场，把情绪先稳稳带起来',
            '能延续前一首的听感，又给歌单增加一点变化',
            '放在中段可以让节奏和情绪更有层次',
            '适合把注意力重新拉回旋律与声线',
            '作为收束会让这组推荐保持完整的余味'
        ];
        const insightText = buildInsightSummary(insights, getPlayableLocalTracks().length, track.isNetease ? 1 : 0);

        return `来自${sourceText}${albumText}，贴合${moodText}；${roleHints[index] || roleHints[0]}，也参考了${insightText}。`;
    }

    function buildRuleBasedRecommendationPlaylistText(recommendedTracks, insights, fallbackIntro, options = {}) {
        const playlistTracks = recommendedTracks.slice(0, 5);
        if (playlistTracks.length === 0) return fallbackIntro || '暂时没有可播放的推荐曲目。';

        const intro = String(fallbackIntro || '').trim().replace(/[。.!！?？]+$/, '');
        const header = intro
            ? `${intro}，我先给你这 5 首歌：`
            : '我先给你这 5 首歌：';
        const items = playlistTracks.map((track, index) =>
            `${index + 1}. ${formatRecommendedTrack(track)}：${buildSingleTrackRecommendationReason(track, index, insights, options)}`
        );

        return [header, ...items].join('\n');
    }

    function recommendationMentionsAllTracks(text, recommendedTracks) {
        const tracksToCheck = recommendedTracks
            .slice(0, 5)
            .filter(track => isMeaningfulTrackTitle(track.title) || isMeaningfulArtist(track.artist));
        if (tracksToCheck.length === 0) return true;

        return tracksToCheck.every(track => recommendationMentionsTrack(text, track));
    }

    function ensurePlaylistReasonCoversTracks(reason, recommendedTracks, insights, fallbackIntro, options = {}) {
        if (reason && recommendationMentionsAllTracks(reason, recommendedTracks)) {
            return reason.trim();
        }

        return buildRuleBasedRecommendationPlaylistText(recommendedTracks, insights, fallbackIntro, options);
    }

    function buildRecommendationPlaylistPrompt(baseInstruction, recommendedTracks, insights, options = {}) {
        const playlistTracks = uniqueTracks(recommendedTracks).slice(0, 5);
        const trackList = playlistTracks
            .map(formatTrackForPrompt)
            .join('\n');
        const insightText = buildInsightSummary(insights, getPlayableLocalTracks().length, playlistTracks.filter(track => track.isNetease).length);
        const moodText = options.moodTag ? `\n用户选择的心情标签：${options.moodTag}` : '';

        return `${baseInstruction}${moodText}\n\n听歌洞察：${insightText}\n\n候选歌曲只能使用下面这 5 首：\n${trackList}\n\n硬性要求：先回复这 5 首歌的歌单；按 1-5 编号逐首写“歌名 - 歌手：推荐理由”；每一首都必须有单独理由；不要只解释第一首；不要推荐、列举或编造候选列表之外的歌名。`;
    }

    async function buildRecommendationPlaylistReason(prompt, recommendedTracks, insights, fallbackIntro, options = {}) {
        if (aiConfig.apiKey && aiConfig.apiKey.trim()) {
            try {
                const reason = await requestAIMessage(prompt);
                return ensurePlaylistReasonCoversTracks(reason, recommendedTracks, insights, fallbackIntro, options);
            } catch (error) {
                aiState.error = error instanceof Error ? error.message : 'AI service is unavailable.';
            }
        }

        return buildRuleBasedRecommendationPlaylistText(recommendedTracks, insights, fallbackIntro, options);
    }

    function ensureReasonTargetsNowPlaying(reason, recommendedTracks, insights, fallbackIntro, options = {}) {
        const actual = getNowPlayingSnapshot().track || recommendedTracks[0];
        if (!actual) return reason || buildRuleBasedRecommendationText(recommendedTracks, insights, fallbackIntro, options);
        if (recommendationMentionsTrack(reason, actual)) return reason.trim();

        const actualFirst = uniqueTracks([
            actual,
            ...recommendedTracks.filter(track => normalizePathForCompare(getTrackSource(track)) !== normalizePathForCompare(getTrackSource(actual)))
        ]);
        return buildRuleBasedRecommendationText(actualFirst, insights, fallbackIntro, options);
    }

    function buildRecommendationPrompt(baseInstruction, recommendedTracks, insights, options = {}) {
        const actual = getNowPlayingSnapshot().track || recommendedTracks[0];
        const promptTracks = uniqueTracks([
            ...(actual ? [actual] : []),
            ...recommendedTracks
        ]);
        const trackList = promptTracks
            .slice(0, 5)
            .map(formatTrackForPrompt)
            .join('\n');
        const insightText = buildInsightSummary(insights, getPlayableLocalTracks().length, recommendedTracks.filter(track => track.isNetease).length);
        const moodText = options.moodTag ? `\n用户选择的心情标签：${options.moodTag}` : '';
        const nowPlayingText = actual ? `\n播放器当前实际状态：${formatTrackForPrompt(actual)}` : '\n播放器当前没有歌曲。';

        return `${baseInstruction}${moodText}${nowPlayingText}\n\n听歌洞察：${insightText}\n\n候选歌曲只能使用下面这 5 首：\n${trackList}\n\n硬性要求：只围绕“播放器当前实际状态”的第一首写 2-4 句中文推荐理由；必须点名这首歌和歌手；不要推荐、列举或编造候选列表之外的歌名。`;
    }

    async function buildRecommendationReason(prompt, recommendedTracks, insights, fallbackIntro, options = {}) {
        if (aiConfig.apiKey && aiConfig.apiKey.trim()) {
            try {
                const reason = await requestAIMessage(prompt);
                return ensureReasonTargetsNowPlaying(reason, recommendedTracks, insights, fallbackIntro, options);
            } catch (error) {
                aiState.error = error instanceof Error ? error.message : 'AI service is unavailable.';
            }
        }

        return buildRuleBasedRecommendationText(recommendedTracks, insights, fallbackIntro, options);
    }

    async function startListening() {
        if (startListeningState.isLoading) return;

        startListeningState = { isLoading: true, error: '' };
        aiState = { isLoading: true, error: null };
        currentView = 'ai-recommend';
        messages.push({
            id: Date.now().toString(),
            type: 'user',
            content: 'Start listening based on my Music Library data',
            timestamp: new Date()
        });
        render();
        scrollChatToBottom();

        try {
            try {
                const insightsPayload = await requestJsonFromCSharp('getListeningInsights', '', 20000);
                listeningInsights = insightsPayload;
            } catch (error) {
                console.warn('Listening insights unavailable:', error);
            }

            const localCandidates = rankLocalTracksByInsights(getPlayableLocalTracks());
            const neteaseCandidates = await fetchStarterNeteaseTracks();
            const recommendedTracks = chooseStartListeningTracks(localCandidates, neteaseCandidates);
            if (recommendedTracks.length === 0) {
                throw new Error('没有找到可播放的本地歌曲或网易云推荐歌曲，请先扫描曲库或启动 NeteaseCloudMusicApi。');
            }

            aiRecommendedTracks = recommendedTracks;
            const playback = await playTrackCollectionConfirmed(recommendedTracks, 0, { detachPlaylist: true });
            setLastAssistantPlaybackContext(playback.track, '根据 Music Library 听歌数据和网易云候选生成推荐', 'Start Listening');
            render();
            scrollChatToBottom();

            const prompt = buildRecommendationPrompt(
                '请根据 MusicAgent 的 Music Library 听歌数据和网易云候选歌曲，生成本次 Start Listening 的推荐理由。',
                recommendedTracks,
                listeningInsights
            );
            const reason = await buildRecommendationReason(prompt, recommendedTracks, listeningInsights, '我根据 Music Library 听歌数据生成了这次推荐。');
            messages.push({
                id: (Date.now() + 1).toString(),
                type: 'ai',
                content: reason,
                timestamp: new Date()
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Start Listening failed.';
            startListeningState = { isLoading: false, error: message };
            aiState.error = message;
            messages.push({
                id: (Date.now() + 1).toString(),
                type: 'ai',
                content: message,
                timestamp: new Date()
            });
        } finally {
            startListeningState.isLoading = false;
            aiState.isLoading = false;
            render();
            scrollChatToBottom();
        }
    }

    function setLastAssistantPlaybackContext(track, reason, query = '') {
        if (!track) return;
        lastAssistantPlaybackContext = {
            sourceUri: getTrackSource(track),
            title: track.title || '',
            artist: track.artist || '',
            reason,
            query,
            createdAt: Date.now()
        };
    }

    function matchesCurrentContext(track) {
        if (!track || !lastAssistantPlaybackContext) return false;
        const currentSource = normalizePathForCompare(getTrackSource(track));
        const contextSource = normalizePathForCompare(lastAssistantPlaybackContext.sourceUri);
        if (currentSource && contextSource && currentSource === contextSource) return true;

        const currentTitle = normalizeRecommendationText(track.title);
        const contextTitle = normalizeRecommendationText(lastAssistantPlaybackContext.title);
        return Boolean(currentTitle && contextTitle && currentTitle === contextTitle);
    }

    function buildCurrentTrackReason(track) {
        const sourceText = track.isNetease ? '来自 NeteaseCloudMusicApi 的网易云曲库' : '来自本地 Music Library';
        const insightText = buildInsightSummary(listeningInsights, getPlayableLocalTracks().length, aiRecommendedTracks.filter(item => item.isNetease).length);
        const contextText = matchesCurrentContext(track) && lastAssistantPlaybackContext.reason
            ? lastAssistantPlaybackContext.reason
            : `播放器当前状态显示这首歌是实际载入的音源，来源是${sourceText}`;
        return `${contextText}；${insightText}。`;
    }

    function buildNowPlayingResponse() {
        const snapshot = getNowPlayingSnapshot();
        if (!snapshot.hasTrack || !snapshot.track) {
            return '我现在没有检测到播放器里有正在播放的歌曲。你可以直接说“帮我播放 One Last Kiss”，我会先去网易云搜索并播放。';
        }

        const statusText = snapshot.isPlaying ? '正在播放' : '当前暂停在';
        return `${statusText}：${formatRecommendedTrack(snapshot.track)}。\n理由：${buildCurrentTrackReason(snapshot.track)}`;
    }

    function isNowPlayingQuestion(content) {
        const text = String(content || '').trim().toLowerCase();
        return /(?:现在|当前|正在).*(?:播放|放|听).*(?:什么|哪首|哪一首|歌名|歌曲)/.test(text) ||
            /(?:播放|放|听).*(?:什么|哪首|哪一首)/.test(text) ||
            /now playing|what(?:'s| is)? playing|what song/i.test(text);
    }

    function isCurrentSongReasonQuestion(content) {
        const text = String(content || '').trim().toLowerCase();
        return /(为什么|原因|理由|推荐理由|适合|why)/.test(text) &&
            /(这首|当前|现在|正在|播放|推荐|song|track)/i.test(text);
    }

    function isRecommendationRequest(content) {
        return /(推荐|心情|氛围|适合|来点|来首|歌单|音乐|听什么|recommend|music|mood)/i.test(String(content || ''));
    }

    function clampVolume(value) {
        return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    }

    function parseVolumeTarget(content) {
        const text = String(content || '').toLowerCase();
        if (!/(音量|声音|声量|volume|vol|静音|mute)/.test(text)) return null;
        if (/取消静音|解除静音|unmute/.test(text)) return Math.max(volume || 70, 30);
        if (/静音|mute/.test(text)) return 0;

        const numeric = text.match(/(\d{1,3})\s*(?:%|％)?/);
        if (numeric && /(到|为|成|设|设置|调至|调到|音量|volume|vol)/.test(text)) {
            return clampVolume(numeric[1]);
        }

        const deltaMatch = text.match(/(?:加|增加|提高|调大|升高|raise|up|louder|减|减少|降低|调小|down|quieter)\D*(\d{1,3})/);
        const delta = deltaMatch ? Number(deltaMatch[1]) : 10;
        if (/(加|增加|提高|调大|升高|raise|up|louder|大一点|高一点)/.test(text)) {
            return clampVolume(volume + delta);
        }
        if (/(减|减少|降低|调小|down|quieter|小一点|低一点)/.test(text)) {
            return clampVolume(volume - delta);
        }

        return null;
    }

    function parsePlaybackMode(content) {
        const text = String(content || '').toLowerCase();
        if (/(随机|shuffle)/.test(text)) return 'shuffle';
        if (/(单曲循环|循环|repeat)/.test(text)) return 'repeat';
        if (/(顺序|列表播放|normal)/.test(text)) return 'normal';
        return null;
    }

    async function setVolumeConfirmed(nextVolume) {
        const target = clampVolume(nextVolume);
        await requestJsonFromCSharp('setVolume', target.toString(), 10000);
        volume = target;
        renderPlayer();
        return `音量已调到 ${target}%。`;
    }

    async function executeSimplePlaybackAction(action, label) {
        await requestJsonFromCSharp(action, '', 60000);
        const snapshot = getNowPlayingSnapshot();
        if (action === 'stop') {
            return '已停止播放。';
        }
        if (snapshot.hasTrack && snapshot.track) {
            return `${label}：${formatRecommendedTrack(snapshot.track)}。`;
        }
        return `${label}。`;
    }

    async function tryExecutePlaybackControl(content) {
        const text = String(content || '').trim().toLowerCase();
        const nextVolume = parseVolumeTarget(text);
        if (nextVolume !== null) {
            return await setVolumeConfirmed(nextVolume);
        }

        if (/(下一首|下首|切歌|next)/.test(text)) {
            return await executeSimplePlaybackAction('next', '已切到下一首');
        }
        if (/(上一首|上首|previous|prev)/.test(text)) {
            return await executeSimplePlaybackAction('previous', '已切到上一首');
        }
        if (/(暂停|pause)/.test(text)) {
            return await executeSimplePlaybackAction('pause', '已暂停');
        }
        if (/(停止|stop)/.test(text)) {
            return await executeSimplePlaybackAction('stop', '已停止播放');
        }
        if (/^(继续播放|恢复播放|继续|恢复|resume|play)$/i.test(text)) {
            if (!getNowPlayingSnapshot().hasTrack && getPlayableQueue().length > 0) {
                const playback = await playTrackCollectionConfirmed(getActiveTrackList(), 0);
                setLastAssistantPlaybackContext(playback.track, '根据当前列表继续播放', '');
                return `已开始播放：${formatRecommendedTrack(playback.track)}。`;
            }
            return await executeSimplePlaybackAction('resume', '已继续播放');
        }

        const mode = parsePlaybackMode(text);
        if (mode) {
            playbackStrategy = mode;
            await requestJsonFromCSharp('setPlaybackStrategy', JSON.stringify({ strategy: mode }), 10000);
            renderPlayer();
            return `播放模式已切换为${getPlaybackStrategyLabel()}。`;
        }

        return null;
    }

    function normalizeSearchText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[《》「」"'\s\-–—_:：/\\()（）\[\]【】.,，。!?！？]/g, '');
    }

    function scoreTrackMatch(query, track) {
        const queryText = normalizeSearchText(query);
        const titleText = normalizeSearchText(track.title);
        const artistText = normalizeSearchText(track.artist);
        const combined = normalizeSearchText(`${track.title}${track.artist}${track.album || ''}`);
        if (!queryText) return 0;
        if (titleText === queryText) return 120;
        if (combined === queryText) return 110;
        if (titleText.includes(queryText)) return 95;
        if (queryText.includes(titleText) && titleText.length >= 2) return 85;
        if (combined.includes(queryText)) return 70;
        if (artistText && queryText.includes(artistText)) return 20;
        return 0;
    }

    function chooseBestTrackMatch(query, candidates) {
        return [...candidates]
            .map((track, index) => ({ track, index, score: scoreTrackMatch(query, track) }))
            .sort((a, b) => b.score - a.score || a.index - b.index)
            .map(item => item.track)[0] || null;
    }

    function searchLocalTracks(query, limit = 5) {
        return tracks
            .filter(track => track.filePath || track.sourceUri)
            .map(track => ({ track: normalizeTrack(track), score: scoreTrackMatch(query, track) }))
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(item => item.track);
    }

    async function searchNeteaseTracks(query, limit = 8) {
        const payload = await requestJsonFromCSharp('searchNeteaseSongs', JSON.stringify({ keywords: query, limit }), 60000);
        return Array.isArray(payload.tracks) ? payload.tracks.map(normalizeTrack) : [];
    }

    function extractPlayQuery(content) {
        const raw = String(content || '').trim();
        const normalized = raw.toLowerCase();
        if (/^(播放|放|听|play)$/.test(normalized)) return '';
        if (/(下一首|上一首|暂停|继续|恢复|音量|静音|随机|循环|顺序|next|previous|pause|resume|volume|mute)/i.test(raw)) return '';

        const patterns = [
            /^(?:帮我|请|给我|麻烦)?\s*(?:播放|放一下|放|来一首|来首|我想听|想听|听)\s*(?:一首|一下|下)?\s*[《「"']?(.+?)[》」"']?\s*(?:吧|谢谢)?$/i,
            /^(?:please\s+)?(?:play|put on)\s+(.+?)\s*$/i
        ];

        for (const pattern of patterns) {
            const match = raw.match(pattern);
            if (!match) continue;
            return match[1]
                .replace(/^(歌曲|歌|音乐)\s*/i, '')
                .replace(/\s*(这首歌|这首|一下|吧|谢谢|please)$/i, '')
                .trim();
        }

        return '';
    }

    function buildPlaybackStartedResponse(track, query, queue) {
        const sourceText = track.isNetease ? 'NeteaseCloudMusicApi/网易云' : '本地曲库';
        const alternatives = queue
            .slice(1, 3)
            .map(formatRecommendedTrack)
            .join('、');
        const queueText = alternatives ? `后续队列里我还放了 ${alternatives}。` : '这次先只播放这一首。';
        return [
            `正在通过${sourceText}为你播放：${formatRecommendedTrack(track)}。`,
            `理由：我用“${query}”匹配歌名、歌手和专辑信息，优先选择了与点歌最接近、并且能交给播放器解析的音源。${queueText}`
        ].join('\n');
    }

    async function playRequestedSong(query) {
        const cleanQuery = String(query || '').trim();
        if (!cleanQuery) {
            return '你想听哪首歌？可以直接说“帮我播放 One Last Kiss”。';
        }

        let neteaseMatches = [];
        let neteaseError = null;
        try {
            neteaseMatches = await searchNeteaseTracks(cleanQuery, 8);
        } catch (error) {
            neteaseError = error;
            console.warn('NetEase search failed:', error);
        }

        const localMatches = searchLocalTracks(cleanQuery, 5);
        const candidates = uniqueTracks([...neteaseMatches, ...localMatches]);
        if (candidates.length === 0) {
            if (neteaseError) {
                throw new Error(`网易云搜索失败：${neteaseError.message || neteaseError}。请确认 NeteaseCloudMusicApi 正在运行，并在 Settings 中检查 API 地址。`);
            }
            throw new Error(`没有找到“${cleanQuery}”的可播放歌曲。`);
        }

        const selected = chooseBestTrackMatch(cleanQuery, candidates) || candidates[0];
        const queue = uniqueTracks([
            selected,
            ...candidates.filter(track => normalizePathForCompare(getTrackSource(track)) !== normalizePathForCompare(getTrackSource(selected)))
        ]).slice(0, 5);
        aiRecommendedTracks = queue;

        const playback = await playTrackCollectionConfirmed(queue, 0, { detachPlaylist: true });
        const actualTrack = getNowPlayingSnapshot().track || playback.track || selected;
        setLastAssistantPlaybackContext(actualTrack, `根据你的点歌“${cleanQuery}”从${actualTrack.isNetease ? '网易云' : '本地曲库'}匹配`, cleanQuery);
        return buildPlaybackStartedResponse(actualTrack, cleanQuery, queue);
    }

    async function executeAIMusicCommand(content) {
        if (isNowPlayingQuestion(content) || isCurrentSongReasonQuestion(content)) {
            return buildNowPlayingResponse();
        }

        const controlResponse = await tryExecutePlaybackControl(content);
        if (controlResponse) {
            return controlResponse;
        }

        const playQuery = extractPlayQuery(content);
        if (playQuery) {
            return await playRequestedSong(playQuery);
        }

        return null;
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

    function getWeeklyDayTotal(day) {
        if (day.platforms?.length) {
            return day.platforms.reduce((sum, slice) => sum + Number(slice.hours || 0), 0);
        }
        return Number(day.hours || 0);
    }

    function getWeeklyMaxHours() {
        const totals = weeklyData.map(getWeeklyDayTotal);
        const maxTotal = Math.max(...totals, 0.1);
        return maxTotal / 0.88;
    }

    function renderWeeklyStackedBar(day, maxHours) {
        const platforms = day.platforms || [];
        const total = getWeeklyDayTotal(day);
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
            <div id="lyrics-panel" class="lyrics-panel flex-1 overflow-y-auto min-h-0">
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

    function getCssImageUrl(value) {
        const url = String(value || getDefaultCover()).replace(/[\r\n]/g, '').replace(/'/g, '%27');
        return `url('${url}')`;
    }

    function getImmersiveDisplayState() {
        const snapshot = getNowPlayingSnapshot();
        const track = snapshot.track;
        const title = track?.title || (isMeaningfulTrackTitle(currentTrackTitle) ? currentTrackTitle : 'No track selected');
        const artist = track?.artist || (isMeaningfulArtist(currentTrackArtist) ? currentTrackArtist : 'Unknown Artist');
        const album = track?.album || (snapshot.sourceUri ? getParentFolderName(snapshot.sourceUri) : 'MusicAgent');
        const coverUrl = track?.coverUrl || currentCoverUrl || getDefaultCover();
        const sourceLabel = track?.isNetease ? '网易云音乐' : '本地曲库';
        const progressPercent = duration > 0
            ? Math.max(0, Math.min(100, (currentTime / duration) * 100))
            : Math.max(0, Math.min(100, progress || 0));

        return {
            title,
            artist,
            album,
            contextName: getCurrentPlaybackContextName(),
            coverUrl,
            sourceLabel,
            progressPercent,
            durationText: duration > 0 ? formatTime(duration) : (track?.duration || '--:--')
        };
    }

    function getCurrentPlaybackContextName() {
        const contextName = activePlaybackPlaylist?.name || selectedPlaylist?.name || '';
        return String(contextName || '').trim();
    }

    function findActiveQueueTrackBySource(source) {
        const normalizedSource = normalizePathForCompare(source);
        if (!normalizedSource) return null;

        return activePlaybackQueue
            .map(normalizeTrack)
            .find(track => normalizePathForCompare(getTrackSource(track)) === normalizedSource) || null;
    }

    function openImmersivePlayer() {
        isImmersivePlayerOpen = true;
        lastImmersiveLyricIndex = -1;
        const source = currentSourceUri || currentFilePath;
        if (source) {
            requestLyricsForSource(source);
        }
        sendToCSharp('enterImmersivePlayer');
        render();
        showImmersiveControls();
        refreshImmersiveAccentFromCover();
    }

    function closeImmersivePlayer() {
        isImmersivePlayerOpen = false;
        clearImmersiveControlsTimer();
        sendToCSharp('exitImmersivePlayer');
        render();
    }

    function renderImmersivePlayer() {
        const state = getImmersiveDisplayState();
        return `
            <div id="immersive-player" class="immersive-player" style="--immersive-cover: ${escapeHtml(getCssImageUrl(state.coverUrl))}; --immersive-progress: ${state.progressPercent}%;">
                <div class="immersive-chromatic" aria-hidden="true"></div>
                <div class="immersive-cover-echo" aria-hidden="true"></div>
                <div class="immersive-colorwash" aria-hidden="true"></div>
                <div class="immersive-grain" aria-hidden="true"></div>
                <button id="immersive-close-btn" class="immersive-close" type="button" title="返回" aria-label="返回">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <div class="immersive-layout">
                    <section class="immersive-copy">
                        <div class="immersive-cover">
                            <img id="immersive-cover-img" src="${escapeHtml(state.coverUrl)}" alt="${escapeHtml(state.title)}" onerror="this.onerror=null;this.src='${escapeHtml(getDefaultCover())}'">
                        </div>
                        <h1 id="immersive-title" class="immersive-title">${escapeHtml(state.title)}</h1>
                        <div id="immersive-artist" class="immersive-artist">${escapeHtml(state.artist)}</div>
                        <div class="immersive-meta">
                            <span id="immersive-album-source">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                <span data-immersive-label>${escapeHtml(getImmersiveAlbumSourceText(state))}</span>
                            </span>
                        </div>
                    </section>
                    <section class="immersive-lyrics-wrap">
                        ${renderImmersiveLyricsContent()}
                    </section>
                </div>
                <div class="immersive-controls">
                    <button id="immersive-play-toggle" class="immersive-play-toggle" type="button" title="${isPlaying ? '暂停' : '播放'}" aria-label="${isPlaying ? '暂停' : '播放'}">
                        ${renderImmersivePlayIcon()}
                    </button>
                    <div class="immersive-timeline">
                        <span id="immersive-current-time">${formatTime(currentTime)}</span>
                        <input type="range" id="immersive-progress-slider" class="immersive-progress-slider" min="0" max="100" value="${state.progressPercent}" style="--immersive-progress: ${state.progressPercent}%;" aria-label="播放进度">
                        <span id="immersive-duration-time">${escapeHtml(state.durationText)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    function renderImmersivePlayIcon() {
        return isPlaying
            ? '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M7 5h3.5v14H7V5zm6.5 0H17v14h-3.5V5z"/></svg>'
            : '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    }

    function renderImmersiveLyricsContent() {
        const activeLyricIndex = getActiveLyricIndex();
        const lineItems = lyrics.length > 0 ? lyrics : [{ text: 'No lyrics loaded', time: 0 }];
        return `
            <div id="immersive-lyrics-panel" class="immersive-lyrics-panel">
                <div id="immersive-lyrics-scroll-inner" class="immersive-lyrics-inner">
                    <div id="immersive-lyrics-pad-top" aria-hidden="true"></div>
                    ${lineItems.map((lyric, index) => {
                        const offset = activeLyricIndex >= 0 ? index - activeLyricIndex : index;
                        const lineStyle = getImmersiveLyricLineStyle(offset);
                        return `
                            <div class="immersive-lyric-line ${index === activeLyricIndex ? 'is-active' : ''}" data-immersive-lyric-index="${index}" style="${lineStyle}">${escapeHtml(lyric.text)}</div>
                        `;
                    }).join('')}
                    <div id="immersive-lyrics-pad-bottom" aria-hidden="true"></div>
                </div>
            </div>
        `;
    }

    function getImmersiveLyricLineStyle(offset) {
        const limited = Math.max(-7, Math.min(7, Number(offset) || 0));
        const distance = Math.abs(limited);
        const closeness = Math.max(0, 7 - distance);
        const rotation = limited * 6.35;
        const x = Math.pow(distance, 1.32) * 18;
        const opacity = Math.min(0.7, 0.13 + closeness * 0.066).toFixed(3);
        const scale = Math.min(1, 0.84 + closeness * 0.023).toFixed(3);
        return [
            `--line-opacity:${opacity}`,
            `--line-scale:${scale}`,
            `--line-rotation:${rotation.toFixed(2)}deg`,
            `--line-x:${x.toFixed(1)}px`
        ].join(';') + ';';
    }

    function attachImmersivePlayerEvents() {
        const page = document.getElementById('immersive-player');
        if (page) {
            ['mousemove', 'pointermove', 'pointerdown'].forEach(eventName => {
                page.addEventListener(eventName, () => showImmersiveControls());
            });
            scheduleImmersiveControlsHide();
        }

        const closeBtn = document.getElementById('immersive-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeImmersivePlayer);
        }

        const playToggle = document.getElementById('immersive-play-toggle');
        if (playToggle) {
            playToggle.addEventListener('click', () => {
                togglePlaybackFromImmersive();
                showImmersiveControls();
            });
        }

        const progressSlider = document.getElementById('immersive-progress-slider');
        if (progressSlider) {
            progressSlider.addEventListener('input', (event) => {
                progress = parseFloat(event.target.value);
                currentTime = duration > 0 ? (progress / 100) * duration : currentTime;
                sendToCSharp('setProgress', progress.toString());
                savePlaybackState(currentTime, true);
                updateImmersivePlayer();
                showImmersiveControls();
            });
        }
    }

    function togglePlaybackFromImmersive() {
        if (isPlaying) {
            savePlaybackState(currentTime, true);
            isPlaying = false;
            sendToCSharp('pause');
        } else if (currentFilePath) {
            isPlaying = true;
            sendToCSharp('resume');
        } else if (getPlayableQueue().length > 0) {
            playTrackFromQueue(0);
            return;
        } else if (localPaths.length > 0) {
            scanAllLocalPaths();
            return;
        } else {
            promptAndPlayFile();
            return;
        }

        renderPlayer();
        updateImmersivePlayer();
    }

    function showImmersiveControls() {
        const page = document.getElementById('immersive-player');
        if (!page) return;

        page.classList.remove('is-controls-hidden');
        scheduleImmersiveControlsHide();
    }

    function scheduleImmersiveControlsHide(delay = 2600) {
        clearImmersiveControlsTimer();
        if (!isImmersivePlayerOpen) return;

        immersiveControlsHideTimer = setTimeout(() => {
            const page = document.getElementById('immersive-player');
            if (page) page.classList.add('is-controls-hidden');
        }, delay);
    }

    function clearImmersiveControlsTimer() {
        if (immersiveControlsHideTimer) {
            clearTimeout(immersiveControlsHideTimer);
            immersiveControlsHideTimer = null;
        }
    }

    function renderImmersiveLyricsPanel() {
        const lyricsPanel = document.getElementById('immersive-lyrics-panel');
        if (lyricsPanel) {
            lyricsPanel.outerHTML = renderImmersiveLyricsContent();
            requestAnimationFrame(() => {
                updateImmersiveLyricsPadding();
                lastImmersiveLyricIndex = -1;
                syncImmersiveLyricHighlight();
            });
        }
    }

    function updateImmersiveLyricsPadding() {
        const container = document.getElementById('immersive-lyrics-panel');
        const padTop = document.getElementById('immersive-lyrics-pad-top');
        const padBottom = document.getElementById('immersive-lyrics-pad-bottom');
        if (!container || !padTop || !padBottom) return;

        const half = Math.max(container.clientHeight / 2, 160);
        padTop.style.height = `${half}px`;
        padBottom.style.height = `${half}px`;
    }

    function syncImmersiveLyricHighlight() {
        const container = document.getElementById('immersive-lyrics-panel');
        if (!container) return;

        const activeLyricIndex = getActiveLyricIndex();
        const indexChanged = activeLyricIndex !== lastImmersiveLyricIndex;
        lastImmersiveLyricIndex = activeLyricIndex;

        document.querySelectorAll('[data-immersive-lyric-index]').forEach(line => {
            const lineIndex = Number(line.dataset.immersiveLyricIndex);
            const isActive = lineIndex === activeLyricIndex;
            line.classList.toggle('is-active', isActive);
            const offset = activeLyricIndex >= 0 ? lineIndex - activeLyricIndex : lineIndex;
            getImmersiveLyricLineStyle(offset)
                .split(';')
                .filter(Boolean)
                .forEach(part => {
                    const [name, value] = part.split(':');
                    if (name && value) line.style.setProperty(name.trim(), value.trim());
                });
        });

        const scrollIndex = activeLyricIndex >= 0 ? activeLyricIndex : 0;
        const activeLine = document.querySelector(`[data-immersive-lyric-index="${scrollIndex}"]`);
        if (activeLine && indexChanged) {
            scrollLyricLineIntoCenter(container, activeLine);
        }
    }

    function updateImmersivePlayer() {
        const page = document.getElementById('immersive-player');
        if (!page) return;

        const state = getImmersiveDisplayState();
        page.style.setProperty('--immersive-cover', getCssImageUrl(state.coverUrl));
        page.style.setProperty('--immersive-progress', `${state.progressPercent}%`);
        refreshImmersiveAccentFromCover(state);

        const coverImg = document.getElementById('immersive-cover-img');
        if (coverImg && coverImg.getAttribute('src') !== state.coverUrl) {
            coverImg.setAttribute('src', state.coverUrl);
            coverImg.setAttribute('alt', state.title);
        }

        const titleEl = document.getElementById('immersive-title');
        if (titleEl) titleEl.textContent = state.title;

        const artistEl = document.getElementById('immersive-artist');
        if (artistEl) artistEl.textContent = state.artist;

        updateImmersiveMetaText('immersive-album-source', getImmersiveAlbumSourceText(state));

        const playToggle = document.getElementById('immersive-play-toggle');
        if (playToggle) {
            playToggle.innerHTML = renderImmersivePlayIcon();
            playToggle.setAttribute('title', isPlaying ? '暂停' : '播放');
            playToggle.setAttribute('aria-label', isPlaying ? '暂停' : '播放');
        }

        const currentTimeEl = document.getElementById('immersive-current-time');
        if (currentTimeEl) currentTimeEl.textContent = formatTime(currentTime);

        const durationTimeEl = document.getElementById('immersive-duration-time');
        if (durationTimeEl) durationTimeEl.textContent = state.durationText;

        const progressSlider = document.getElementById('immersive-progress-slider');
        if (progressSlider) {
            progressSlider.value = state.progressPercent;
            progressSlider.style.setProperty('--immersive-progress', `${state.progressPercent}%`);
        }

        syncImmersiveLyricHighlight();
    }

    function updateImmersiveMetaText(id, text) {
        const el = document.querySelector(`#${id} [data-immersive-label]`);
        if (el) el.textContent = text;
    }

    function getImmersiveAlbumSourceText(state) {
        const album = String(state?.album || '').trim();
        const contextName = String(state?.contextName || '').trim();
        const sourceLabel = String(state?.sourceLabel || '').trim();
        if (album && album !== 'Local Music' && album !== '网易云音乐') return album;
        if (contextName) return contextName;
        if (sourceLabel && sourceLabel !== '网易云音乐') return sourceLabel;
        return album && album !== '网易云音乐' ? album : 'MusicAgent';
    }

    function refreshImmersiveAccentFromCover(state = getImmersiveDisplayState()) {
        const page = document.getElementById('immersive-player');
        if (!page) return;

        const key = `${state.coverUrl}|${state.title}`;
        const cachedPalette = immersivePaletteCache.get(key);
        if (cachedPalette) {
            applyImmersivePalette(page, cachedPalette);
            currentImmersivePaletteKey = key;
            return;
        }

        const fallbackPalette = getFallbackPalette(key);
        applyImmersivePalette(page, fallbackPalette);
        if (currentImmersivePaletteKey === key) return;
        currentImmersivePaletteKey = key;

        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
            try {
                const palette = extractPaletteFromImage(image) || fallbackPalette;
                immersivePaletteCache.set(key, palette);
                const activeState = getImmersiveDisplayState();
                const activeKey = `${activeState.coverUrl}|${activeState.title}`;
                const activePage = document.getElementById('immersive-player');
                if (activeKey === key && activePage) {
                    applyImmersivePalette(activePage, palette);
                }
            } catch {
                immersivePaletteCache.set(key, fallbackPalette);
                const activePage = document.getElementById('immersive-player');
                if (activePage) applyImmersivePalette(activePage, fallbackPalette);
            }
        };
        image.onerror = () => {
            immersivePaletteCache.set(key, fallbackPalette);
            const activePage = document.getElementById('immersive-player');
            if (activePage) applyImmersivePalette(activePage, fallbackPalette);
        };
        image.src = state.coverUrl || getDefaultCover();
    }

    function extractPaletteFromImage(image) {
        const canvas = document.createElement('canvas');
        const size = 32;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return null;

        context.drawImage(image, 0, 0, size, size);
        const data = context.getImageData(0, 0, size, size).data;
        const buckets = [];
        for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const saturation = max === 0 ? 0 : (max - min) / max;
            const lightness = (max + min) / 510;
            if (lightness < 0.12 || lightness > 0.88 || saturation < 0.12) continue;
            buckets.push({ r, g, b, score: saturation * 1.8 + lightness });
        }

        if (buckets.length === 0) return null;
        buckets.sort((a, b) => b.score - a.score);
        const accent = buckets[0];
        const soft = buckets[Math.min(8, buckets.length - 1)] || accent;
        const shadow = {
            r: Math.max(2, Math.round(accent.r * 0.08)),
            g: Math.max(6, Math.round(accent.g * 0.08)),
            b: Math.max(12, Math.round(accent.b * 0.09))
        };
        return { accent, soft, shadow };
    }

    function applyImmersivePalette(page, palette) {
        page.style.setProperty('--accent-rgb', `${palette.accent.r}, ${palette.accent.g}, ${palette.accent.b}`);
        page.style.setProperty('--accent-soft-rgb', `${palette.soft.r}, ${palette.soft.g}, ${palette.soft.b}`);
        page.style.setProperty('--shadow-rgb', `${palette.shadow.r}, ${palette.shadow.g}, ${palette.shadow.b}`);
    }

    function getFallbackPalette(seed) {
        let hash = 0;
        String(seed || '').split('').forEach(char => {
            hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
        });
        const hue = Math.abs(hash) % 360;
        const accent = hslToRgb(hue, 72, 58);
        const soft = hslToRgb((hue + 74) % 360, 68, 62);
        const shadow = hslToRgb((hue + 212) % 360, 42, 8);
        return { accent, soft, shadow };
    }

    function hslToRgb(h, s, l) {
        const saturation = s / 100;
        const lightness = l / 100;
        const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
        const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
        const m = lightness - chroma / 2;
        let r = 0;
        let g = 0;
        let b = 0;

        if (h < 60) {
            r = chroma; g = x;
        } else if (h < 120) {
            r = x; g = chroma;
        } else if (h < 180) {
            g = chroma; b = x;
        } else if (h < 240) {
            g = x; b = chroma;
        } else if (h < 300) {
            r = x; b = chroma;
        } else {
            r = chroma; b = x;
        }

        return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255)
        };
    }

    function isDesktopHost() {
        return !!(window.chrome && window.chrome.webview);
    }

    function renderWindowChrome() {
        if (!isDesktopHost() || isImmersivePlayerOpen) return '';

        const maximizeIcon = windowDisplayState === 'maximized'
            ? '<svg class="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2.5" y="2.5" width="7" height="7" rx="0.5"/><path d="M4 2.5V2a1 1 0 0 1 1-1h4.5a1 1 0 0 1 1 1v4.5"/></svg>'
            : '<svg class="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1.75" y="1.75" width="8.5" height="8.5" rx="0.5"/></svg>';

        return `
            <header class="window-chrome">
                <div class="window-drag-strip" id="window-drag-strip">
                    <span class="window-drag-title">MusicAgent</span>
                </div>
                <div class="window-controls">
                    <button type="button" class="window-control-btn" data-window-action="minimize" title="最小化" aria-label="最小化">
                        <svg class="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="5.5" width="8" height="1" rx="0.5"/></svg>
                    </button>
                    <button type="button" class="window-control-btn" data-window-action="maximize" title="${windowDisplayState === 'maximized' ? '还原' : '最大化'}" aria-label="${windowDisplayState === 'maximized' ? '还原' : '最大化'}">
                        ${maximizeIcon}
                    </button>
                    <button type="button" class="window-control-btn window-control-close" data-window-action="close" title="关闭" aria-label="关闭">
                        <svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7"/></svg>
                    </button>
                </div>
            </header>
        `;
    }

    function attachWindowChromeListeners() {
        document.querySelectorAll('[data-window-action]').forEach(btn => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                handleWindowControlAction(btn.dataset.windowAction);
            });
        });

        const dragStrip = document.getElementById('window-drag-strip');
        if (!dragStrip) return;

        dragStrip.addEventListener('mousedown', (event) => {
            if (event.button !== 0) return;
            sendToCSharp('windowDragStart');
        });

        dragStrip.addEventListener('dblclick', () => {
            handleWindowControlAction('maximize');
        });
    }

    function handleWindowControlAction(action) {
        if (!isDesktopHost()) return;

        if (action === 'minimize') {
            sendToCSharp('windowMinimize');
            return;
        }

        if (action === 'close') {
            sendToCSharp('windowClose');
            return;
        }

        if (action === 'maximize') {
            requestFromCSharp('windowMaximizeToggle')
                .then(({ data }) => {
                    windowDisplayState = data === 'maximized' ? 'maximized' : 'normal';
                    render();
                })
                .catch(() => sendToCSharp('windowMaximizeToggle'));
        }
    }

    function render() {
        const app = document.getElementById('app');
        app.innerHTML = `
            ${renderWindowChrome()}
            <div class="app-body flex flex-1 overflow-hidden">
                ${renderSidebar()}
                <div class="content-area">
                    <div class="main-content" id="main-content">
                        ${renderView()}
                    </div>
                    ${renderPlayerBar()}
                </div>
            </div>
            ${isImmersivePlayerOpen ? renderImmersivePlayer() : ''}
        `;
        attachEventListeners();
        if (currentView === 'library' && shouldScrollLibraryTrackList) {
            scrollLibraryTrackListIntoView('auto');
        }
        if (currentView === 'ai-recommend') {
            requestAnimationFrame(() => {
                updateLyricsPadding();
                lastActiveLyricIndex = -1;
                syncLyricHighlight();
            });
        }
        if (isImmersivePlayerOpen) {
            requestAnimationFrame(() => {
                updateImmersiveLyricsPadding();
                lastImmersiveLyricIndex = -1;
                updateImmersivePlayer();
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
                        <div class="flex-1 overflow-auto space-y-4 mb-6 pr-1 app-scroll" id="chat-messages">
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
        const moodGradients = ['from-rose-500 to-red-600', 'from-indigo-500 to-sky-600', 'from-emerald-500 to-teal-600', 'from-violet-500 to-fuchsia-600', 'from-amber-500 to-orange-600', 'from-cyan-500 to-blue-600', 'from-pink-500 to-rose-600', 'from-slate-500 to-purple-600'];
        const chartCards = neteaseTopCharts.length > 0
            ? neteaseTopCharts.map((chart, index) => {
                const previewTracks = chart.tracks;
                return `
                    <button class="card hover:border-red-500/40 transition-all text-left group overflow-hidden" data-netease-chart-id="${escapeHtml(chart.playlistId)}" data-chart-title="${escapeHtml(chart.name)}">
                        <div class="flex items-start gap-4 mb-4">
                            <div class="w-16 h-16 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                                ${chart.coverUrl ? `<img src="${escapeHtml(chart.coverUrl)}" alt="${escapeHtml(chart.name)}" class="w-full h-full object-cover" loading="lazy" onerror="this.style.display='none'">` : `<div class="w-full h-full bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center text-lg font-bold">#${index + 1}</div>`}
                            </div>
                            <div class="min-w-0">
                                <div class="text-xs text-red-300 mb-1">${escapeHtml(chart.updateFrequency || '网易云官方榜')}</div>
                                <h4 class="font-semibold truncate">${escapeHtml(chart.name)}</h4>
                                <p class="text-xs text-gray-500 mt-1">${chart.trackCount ? `${chart.trackCount} 首` : '实时榜单'}</p>
                            </div>
                        </div>
                        <div class="space-y-2">
                            ${previewTracks.length > 0
                                ? previewTracks.slice(0, 3).map((track, idx) => `<div class="text-sm text-gray-400 truncate">${idx + 1}. ${escapeHtml(track.title)}${track.artist ? ` - ${escapeHtml(track.artist)}` : ''}</div>`).join('')
                                : '<div class="text-sm text-gray-500">暂无曲目预览</div>'}
                        </div>
                    </button>
                `;
            }).join('')
            : `
                <div class="col-span-4 card text-center text-gray-400">
                    <div class="text-lg font-medium text-white mb-2">${isLoadingNeteaseTopCharts ? '正在加载网易云热榜…' : '暂无网易云热榜数据'}</div>
                    <div class="text-sm">${isLoadingNeteaseTopCharts ? '请确认 NeteaseCloudMusicApi 正在运行' : '在 Settings 中确认 API 地址后重试'}</div>
                </div>
            `;
        const moodCards = neteaseMoodTags.length > 0
            ? neteaseMoodTags.map((tag, index) => `
                <button class="mood-card bg-gradient-to-br ${moodGradients[index % moodGradients.length]} text-left" data-mood-tag="${escapeHtml(tag.name)}">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-2v13M9 19c0 1.105-1.79 2-4 2s-4-.895-4-2 1.79-2 4-2 4 .895 4 2zm12-2c0 1.105-1.79 2-4 2s-4-.895-4-2 1.79-2 4-2 4 .895 4 2zM9 10l12-2"/></svg>
                    <div>
                        <h4 class="text-lg font-semibold">${escapeHtml(tag.name)}</h4>
                        <p class="text-xs text-white/70 mt-1">${tag.hot ? '热门氛围' : '网易云歌单标签'}</p>
                    </div>
                </button>
            `).join('')
            : `
                <div class="col-span-3 card text-center text-gray-400">
                    <div class="text-lg font-medium text-white mb-2">${isLoadingNeteaseMoodTags ? '正在加载心情氛围…' : '暂无心情氛围数据'}</div>
                    <div class="text-sm">${isLoadingNeteaseMoodTags ? '从网易云歌单分类获取场景与情感标签' : '请检查 NeteaseCloudMusicApi 服务'}</div>
                </div>
            `;
        return `
            <div class="space-y-8">
                <div class="relative h-64 rounded-2xl overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=400&fit=crop" alt="AI Discovery" class="w-full h-full object-cover">
                    <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent flex items-center">
                        <div class="p-12">
                            <h2 class="text-4xl font-bold mb-3">今日推荐</h2>
                            <p class="text-lg text-gray-300 mb-6">结合 Music Library 听歌数据与网易云热榜生成推荐</p>
                            <button id="start-listening-btn" class="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all font-medium disabled:opacity-60" ${startListeningState.isLoading ? 'disabled' : ''}>${startListeningState.isLoading ? 'Preparing…' : 'Start Listening'}</button>
                            ${startListeningState.error ? `<div class="mt-3 text-sm text-red-200">${escapeHtml(startListeningState.error)}</div>` : ''}
                        </div>
                    </div>
                </div>
                <div>
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-2xl font-bold">NetEase Hot Charts</h3>
                        ${isLoadingExploreTracks ? '<span class="text-sm text-red-300">加载曲目中…</span>' : ''}
                    </div>
                    <div class="grid grid-cols-4 gap-4">
                        ${chartCards}
                    </div>
                </div>
                <div>
                    <h3 class="text-2xl font-bold mb-6">心情氛围</h3>
                    <div class="grid grid-cols-3 gap-4">
                        ${moodCards}
                    </div>
                </div>
            </div>
        `;
    }

    function renderLibrary() {
        const libraryPlaylists = getLibraryPlaylists();
        const hasLocalLibraries = localPaths.length > 0;
        const hasNeteasePlaylists = neteasePlaylists.length > 0;
        const hasAnyPlaylists = libraryPlaylists.length > 0;
        const trackListTitle = selectedPlaylist?.isAIRecommendation
            ? selectedPlaylist.name
            : (selectedPlaylist?.isNetease
            ? `${selectedPlaylist.name}（网易云）`
            : (selectedPlaylist?.isLocal ? selectedPlaylist.name : 'Local Tracks'));
        const visibleTracks = selectedPlaylist?.isAIRecommendation
            ? aiRecommendedTracks
            : (selectedPlaylist?.isNetease
            ? neteaseTracks
            : (selectedPlaylist?.isLocal
                ? tracks.filter(track => track.filePath && track.filePath.startsWith(selectedPlaylist.path))
                : tracks));
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
                        ${hasAnyPlaylists ? libraryPlaylists.map(playlist => {
                            const playlistAttrs = playlist.isAIRecommendation
                                ? 'data-ai-recommendation-playlist="true"'
                                : (playlist.isNetease ? `data-netease-playlist-id="${playlist.externalId}"` : `data-local-playlist-index="${playlist.sourceIndex}"`);
                            const badge = playlist.isAIRecommendation
                                ? '<span class="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] rounded bg-purple-500/80">AI</span>'
                                : (playlist.isNetease ? '<span class="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] rounded bg-red-500/80">网易</span>' : '');
                            return `
                            <div class="cursor-pointer rounded-lg p-3 transition-all ${selectedPlaylist && selectedPlaylist.id === playlist.id ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-white/5 border border-transparent hover:bg-white/10'}" ${playlistAttrs}>
                                <div class="aspect-square rounded-lg overflow-hidden mb-3 relative">
                                    <img src="${escapeHtml(playlist.cover || getDefaultCover())}" alt="${playlist.name || 'Playlist'}" class="w-full h-full object-cover" loading="lazy" onerror="this.onerror=null;this.src='${escapeHtml(getDefaultCover())}'">
                                    ${badge}
                                </div>
                                <h4 class="font-medium text-sm truncate">${playlist.name || 'Untitled Playlist'}</h4>
                                <p class="text-xs text-gray-400">${playlist.tracks ?? 0} 首 · ${playlist.duration || '--'}</p>
                            </div>
                        `}).join('') : `
                            <button class="col-span-5 p-8 rounded-lg bg-white/5 border border-white/10 text-center hover:bg-white/10 transition-colors" data-empty-manual-play="true">
                                <div class="text-lg font-medium mb-2">鏆傛棤姝屾洸</div>
                                <div class="text-sm text-gray-400">Click to manually enter an audio file path to play</div>
                            </button>
                        `}
                    </div>
                </div>
                <div class="card" id="library-track-list">
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
                                <div class="text-sm">${isLoadingNeteaseTracks ? '首次打开会从网易云拉取曲目' : (selectedPlaylist?.isNetease ? '曲目加载后会显示在这里' : emptyTrackHint)}</div>
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
                    <button id="player-cover-btn" class="player-cover-button w-16 h-16 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center overflow-hidden shrink-0" type="button" title="打开全屏播放页" aria-label="打开全屏播放页">
                        <img src="${escapeHtml(currentCoverUrl || getDefaultCover())}" alt="Album" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='${escapeHtml(getDefaultCover())}'">
                    </button>
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
            updateImmersivePlayer();
        }
    }

    function attachEventListeners() {
        attachWindowChromeListeners();

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

        document.querySelectorAll('[data-ai-recommendation-playlist]').forEach(el => {
            el.addEventListener('click', () => {
                const playlist = selectAIRecommendationPlaylist();
                if (!playlist) return;

                render();
                scrollLibraryTrackListIntoView();
            });
        });

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
                    isScanningLocalPaths = true;
                    sendToCSharp('scanFolder', JSON.stringify({ Path: playlist.path }));
                }
                render();
                scrollLibraryTrackListIntoView();
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

        const startListeningBtn = document.getElementById('start-listening-btn');
        if (startListeningBtn) {
            startListeningBtn.addEventListener('click', startListening);
        }

        document.querySelectorAll('[data-netease-chart-id]').forEach(card => {
            card.addEventListener('click', () => {
                openNeteaseChartInLibrary(card.dataset.neteaseChartId, card.dataset.chartTitle || '网易云热榜');
            });
        });

        document.querySelectorAll('[data-mood-tag]').forEach(card => {
            card.addEventListener('click', () => {
                playNeteaseMood(card.dataset.moodTag);
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
        attachImmersivePlayerEvents();
    }

    function attachPlayerEvents() {
        const playerCoverBtn = document.getElementById('player-cover-btn');
        if (playerCoverBtn) {
            playerCoverBtn.addEventListener('click', openImmersivePlayer);
        }

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
        render();
        scrollChatToBottom();

        try {
            const commandResponse = await executeAIMusicCommand(content);
            if (commandResponse) {
                messages.push({
                    id: (Date.now() + 1).toString(),
                    type: 'ai',
                    content: commandResponse,
                    timestamp: new Date()
                });
            } else {
                if (isRecommendationRequest(content)) {
                    aiRecommendedTracks = recommendLocalTracks(content);
                }

                try {
                    const responseText = await requestAIMessage(content);
                    messages.push({
                        id: (Date.now() + 1).toString(),
                        type: 'ai',
                        content: responseText,
                        timestamp: new Date()
                    });
                } catch (error) {
                    const fallbackText = isRecommendationRequest(content)
                        ? buildLocalRecommendationText(content, aiRecommendedTracks)
                        : (error instanceof Error ? error.message : 'AI service is unavailable.');
                    messages.push({
                        id: (Date.now() + 1).toString(),
                        type: 'ai',
                        content: fallbackText,
                        timestamp: new Date()
                    });
                    aiState.error = error instanceof Error ? error.message : 'AI service is unavailable.';
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : '音乐指令执行失败。';
            messages.push({
                id: (Date.now() + 1).toString(),
                type: 'ai',
                content: message,
                timestamp: new Date()
            });
            aiState.error = message;
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
