(function (window) {
    'use strict';

    function buildDonutGradient(platformData) {
        if (!platformData.length) {
            return 'conic-gradient(#4b5563 0deg 360deg)';
        }

        const total = platformData.reduce((sum, p) => sum + Number(p.value || 0), 0);
        if (total <= 0) {
            return 'conic-gradient(#4b5563 0deg 360deg)';
        }

        let current = 0;
        const segments = platformData.map(p => {
            const value = Number(p.value || 0);
            const start = current;
            const end = current + (value / total) * 360;
            current = end;
            return `${p.color} ${start}deg ${end}deg`;
        });

        return `conic-gradient(${segments.join(', ')})`;
    }

    function getWeeklyDayTotal(day) {
        if (day.platforms?.length) {
            return day.platforms.reduce((sum, slice) => sum + Number(slice.hours || 0), 0);
        }

        return Number(day.hours || 0);
    }

    function getWeeklyMaxHours(weeklyData) {
        const totals = weeklyData.map(getWeeklyDayTotal);
        const maxTotal = Math.max(...totals, 0.1);
        return maxTotal / 0.88;
    }

    function getWeeklyBarHeight(hours, maxHours) {
        if (!Number.isFinite(hours) || hours <= 0) return 4;
        return Math.max((hours / maxHours) * 100, 8);
    }

    function renderWeeklyStackedBar(day, maxHours, deps) {
        const platforms = day.platforms?.length
            ? day.platforms
            : (Number(day.hours || 0) > 0 ? [{ name: 'Local', hours: Number(day.hours || 0), color: '#8B5CF6' }] : []);
        const total = getWeeklyDayTotal(day);
        const barHeightPct = getWeeklyBarHeight(total, maxHours);

        if (total <= 0 || platforms.length === 0) {
            return '<div class="w-full bg-gray-700/30 rounded-t-lg" style="height:4%"></div>';
        }

        const segments = platforms.map(slice => {
            const segPct = total > 0 ? (Number(slice.hours) / total) * 100 : 0;
            return `<div class="w-full" style="height:${segPct}%;background:${slice.color};min-height:${slice.hours > 0 ? '2px' : '0'}" title="${deps.escapeHtml(slice.name)} ${slice.hours}h"></div>`;
        }).join('');

        return `
            <div class="w-full flex flex-col justify-end rounded-t-lg overflow-hidden" style="height:${barHeightPct}%">
                ${segments}
            </div>
        `;
    }

    function getWeekTotalHours(weeklyData) {
        return weeklyData.reduce((sum, day) => {
            if (day.platforms?.length) {
                return sum + day.platforms.reduce((inner, slice) => inner + Number(slice.hours || 0), 0);
            }

            return sum + Number(day.hours || 0);
        }, 0);
    }

    function renderWeeklyReportCard(state, deps) {
        const weeklyData = Array.isArray(state.weeklyData) ? state.weeklyData : [];
        const maxHours = getWeeklyMaxHours(weeklyData);
        const weekTotalHours = getWeekTotalHours(weeklyData);

        return `
            <div class="card">
                <h3 class="text-xl font-semibold mb-6">Weekly Report</h3>
                <div class="flex items-end gap-3 h-48">
                    ${weeklyData.map(d => `
                        <div class="flex-1 h-full flex flex-col items-center justify-end gap-2">
                            ${renderWeeklyStackedBar(d, maxHours, deps)}
                            <span class="text-xs text-gray-400">${deps.escapeHtml(d.day)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="mt-4 text-sm text-gray-400">Total: <span class="text-white font-semibold">${weekTotalHours.toFixed(1)} hours</span> this week</div>
            </div>
        `;
    }

    function renderListeningTimeCard(state, deps) {
        const platformData = Array.isArray(state.platformData) ? state.platformData : [];
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
                                    <span>${deps.escapeHtml(deps.formatPlatformName(p.name))}</span>
                                </div>
                                <span class="text-gray-400">${Number(p.value || 0)}h</span>
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

    function getVisibleTracks(state) {
        const selectedPlaylist = state.selectedPlaylist;
        if (selectedPlaylist?.isLikedPlaylist) return state.likedTracks;
        if (selectedPlaylist?.isAIRecommendation) return state.aiRecommendedTracks;
        if (selectedPlaylist?.isNetease) return state.neteaseTracks;
        if (selectedPlaylist?.isLocal) {
            return state.tracks.filter(track => track.filePath && track.filePath.startsWith(selectedPlaylist.path));
        }

        return state.tracks;
    }

    function getTrackListTitle(state) {
        const selectedPlaylist = state.selectedPlaylist;
        if (selectedPlaylist?.isLikedPlaylist) return '我喜欢的音乐';
        if (selectedPlaylist?.isAIRecommendation) return selectedPlaylist.name;
        if (selectedPlaylist?.isNetease) return `${selectedPlaylist.name}（网易云）`;
        if (selectedPlaylist?.isLocal) return selectedPlaylist.name;
        return 'Local Tracks';
    }

    function getEmptyTrackCopy(state) {
        if (state.selectedPlaylist?.isNetease) {
            return {
                title: '请选择网易云歌单或先同步',
                hint: '曲目加载后会显示在这里'
            };
        }

        if (state.localPaths.length > 0 && state.isScanningLocalPaths) {
            return {
                title: '正在读取已保存歌单歌曲...',
                hint: '扫描完成后歌曲会自动显示在这里'
            };
        }

        if (state.localPaths.length > 0) {
            return {
                title: '暂无歌曲',
                hint: '点击重新扫描已保存的曲库路径'
            };
        }

        return {
            title: '暂无歌曲',
            hint: '点击手动输入音频文件路径播放'
        };
    }

    function renderPlaylistCard(playlist, state, deps) {
        const playlistAttrs = playlist.isLikedPlaylist
            ? 'data-liked-playlist="true"'
            : (playlist.isAIRecommendation
                ? 'data-ai-recommendation-playlist="true"'
                : (playlist.isNetease ? `data-netease-playlist-id="${playlist.externalId}"` : `data-local-playlist-index="${playlist.sourceIndex}"`));
        const badge = playlist.isLikedPlaylist
            ? '<span class="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] rounded bg-red-500/80">喜欢</span>'
            : (playlist.isAIRecommendation
                ? '<span class="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] rounded bg-purple-500/80">AI</span>'
                : (playlist.isNetease ? '<span class="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] rounded bg-red-500/80">网易</span>' : ''));
        const isSelected = state.selectedPlaylist && state.selectedPlaylist.id === playlist.id;
        const playlistName = playlist.name || 'Untitled Playlist';

        return `
            <div class="cursor-pointer rounded-lg p-3 transition-all ${isSelected ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-white/5 border border-transparent hover:bg-white/10'}" ${playlistAttrs}>
                <div class="aspect-square rounded-lg overflow-hidden mb-3 relative">
                    <img src="${deps.escapeHtml(playlist.cover || deps.getDefaultCover())}" alt="${deps.escapeHtml(playlistName)}" class="w-full h-full object-cover" loading="lazy" onerror="this.onerror=null;this.src='${deps.escapeHtml(deps.getDefaultCover())}'">
                    ${badge}
                </div>
                <h4 class="font-medium text-sm truncate">${deps.escapeHtml(playlistName)}</h4>
                <p class="text-xs text-gray-400">${Number(playlist.tracks ?? 0)} 首 · ${deps.escapeHtml(playlist.duration || '--')}</p>
            </div>
        `;
    }

    function renderTrackRow(track, index, state, deps) {
        return `
            <div class="track-row group ${state.isPlaying && state.currentQueueIndex === index ? 'is-playing' : ''}" data-visible-track-index="${index}">
                <div class="w-8 text-gray-400 text-sm shrink-0">${index + 1}</div>
                <div class="track-cover">
                    ${deps.renderCoverImg(track)}
                    <div class="track-play">
                        <svg class="w-4 h-4 fill-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-medium truncate">${deps.escapeHtml(track.title || 'Untitled Track')}</div>
                    <div class="text-sm text-gray-400 truncate">${deps.escapeHtml(track.artist || 'Unknown Artist')}</div>
                </div>
                <div class="text-sm text-gray-400">${deps.escapeHtml(track.album || 'Local Music')}</div>
                <div class="text-sm text-gray-400 w-16 text-right">${deps.escapeHtml(track.duration || '--:--')}</div>
            </div>
        `;
    }

    function renderLibrary(state, deps) {
        const libraryPlaylists = deps.getLibraryPlaylists();
        const hasAnyPlaylists = libraryPlaylists.length > 0;
        const trackListTitle = getTrackListTitle(state);
        const visibleTracks = getVisibleTracks(state);
        const emptyCopy = getEmptyTrackCopy(state);

        return `
            <div class="space-y-6">
                <div class="grid grid-cols-2 gap-6">
                    <div id="library-weekly-report">${renderWeeklyReportCard(state, deps)}</div>
                    <div id="library-listening-time">${renderListeningTimeCard(state, deps)}</div>
                </div>
                <div class="card">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-semibold">歌单</h3>
                        ${state.neteaseStatus.loggedIn ? `
                            <button id="library-sync-netease-btn" class="px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 rounded-lg border border-red-500/30 text-red-300 transition-colors" ${state.isNeteaseSyncing ? 'disabled' : ''}>
                                ${state.isNeteaseSyncing ? '同步中…' : '同步网易云'}
                            </button>
                        ` : ''}
                    </div>
                    <div class="grid grid-cols-5 gap-4">
                        ${hasAnyPlaylists ? libraryPlaylists.map(playlist => renderPlaylistCard(playlist, state, deps)).join('') : `
                            <button class="col-span-5 p-8 rounded-lg bg-white/5 border border-white/10 text-center hover:bg-white/10 transition-colors" data-empty-manual-play="true">
                                <div class="text-lg font-medium mb-2">暂无歌单</div>
                                <div class="text-sm text-gray-400">点击手动输入音频文件路径播放</div>
                            </button>
                        `}
                    </div>
                </div>
                <div class="card" id="library-track-list">
                    <h3 class="text-xl font-semibold mb-6">${deps.escapeHtml(trackListTitle)}${state.isLoadingNeteaseTracks ? ' <span class="text-sm text-gray-400 font-normal">加载中…</span>' : ''}</h3>
                    <div class="space-y-2">
                        ${visibleTracks.length > 0 ? visibleTracks.map((track, index) => renderTrackRow(track, index, state, deps)).join('') : `
                            <div class="w-full p-8 rounded-lg bg-white/5 border border-white/10 text-center text-gray-400">
                                <div class="text-lg font-medium mb-2 text-white">${state.isLoadingNeteaseTracks ? '正在加载歌单曲目…' : emptyCopy.title}</div>
                                <div class="text-sm">${state.isLoadingNeteaseTracks ? '首次打开会从网易云拉取曲目' : emptyCopy.hint}</div>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    window.MusicAgentLibraryView = {
        renderLibrary,
        renderListeningTimeCard,
        renderWeeklyReportCard
    };
})(window);
