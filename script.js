// DOM Elements
const video = document.getElementById('video');
const m3u8UrlInput = document.getElementById('m3u8Url');
const playBtn = document.getElementById('playBtn');
const playerMessage = document.getElementById('playerMessage');
const loadingSpinner = document.getElementById('loadingSpinner');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const playlistContainer = document.getElementById('playlistContainer');
const tabHistory = document.getElementById('tabHistory');
const tabFavorites = document.getElementById('tabFavorites');
const listTitle = document.getElementById('listTitle');
const clearListBtn = document.getElementById('clearListBtn');
const btnFavorite = document.getElementById('btnFavorite'); // Changed from addToFavBtn
const importBtn = document.getElementById('importBtn');
const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importInput');

// Modal Elements
const favModal = document.getElementById('favModal');
const closeFavModal = document.getElementById('closeFavModal');
const cancelFavBtn = document.getElementById('cancelFavBtn');
const confirmFavBtn = document.getElementById('confirmFavBtn');
const favNote = document.getElementById('favNote');
const favUrlDisplay = document.getElementById('favUrlDisplay');

// State
let hls = null;
let currentTab = 'history'; // 'history' or 'favorites'

// Constants
const STORAGE_KEYS = {
    HISTORY: 'm3u8_history',
    FAVORITES: 'm3u8_favorites'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadList(currentTab);
    
    // Check for URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const url = urlParams.get('url');
    if (url) {
        m3u8UrlInput.value = url;
        playVideo(url);
    } else {
        // Also check if there's a value in input (e.g. browser autofill or reload)
        const inputUrl = m3u8UrlInput.value.trim();
        if (inputUrl) {
            updateFavoriteBtnState(inputUrl);
        }
    }
});

// Event Listeners
playBtn.addEventListener('click', () => {
    const url = m3u8UrlInput.value.trim();
    if (url) {
        playVideo(url);
    }
});

m3u8UrlInput.addEventListener('input', () => {
    const url = m3u8UrlInput.value.trim();
    updateFavoriteBtnState(url);
});

m3u8UrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const url = m3u8UrlInput.value.trim();
        if (url) {
            playVideo(url);
        }
    }
});

tabHistory.addEventListener('click', () => switchTab('history'));
tabFavorites.addEventListener('click', () => switchTab('favorites'));

clearListBtn.addEventListener('click', () => {
    if (confirm('确定要清空当前列表吗？')) {
        const key = currentTab === 'history' ? STORAGE_KEYS.HISTORY : STORAGE_KEYS.FAVORITES;
        localStorage.removeItem(key);
        loadList(currentTab);
    }
});

btnFavorite.addEventListener('click', () => {
    const url = m3u8UrlInput.value.trim();
    if (!url) return alert('请先输入有效的视频地址');
    
    // Check if already in favorites to pre-fill note
    const favorites = getStorage(STORAGE_KEYS.FAVORITES);
    const existing = favorites.find(item => item.url === url);
    
    // Open Modal
    favUrlDisplay.textContent = url;
    favNote.value = existing ? existing.title : '';
    favModal.classList.remove('hidden');
    favNote.focus();
});

// Import/Export Handlers
exportBtn.addEventListener('click', () => {
    const favorites = getStorage(STORAGE_KEYS.FAVORITES);
    if (favorites.length === 0) return alert('收藏夹为空，无法导出');
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(favorites));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "m3u8_favorites.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});

importBtn.addEventListener('click', () => {
    importInput.click();
});

importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                // Merge with existing
                const existing = getStorage(STORAGE_KEYS.FAVORITES);
                // Create map for existing items by URL
                const map = new Map(existing.map(item => [item.url, item]));
                
                imported.forEach(item => {
                    if (item.url && item.title) {
                        map.set(item.url, {
                            url: item.url,
                            title: item.title,
                            timestamp: item.timestamp || new Date().getTime()
                        });
                    }
                });
                
                // Convert back to array and sort by timestamp desc
                const merged = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
                localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(merged));
                
                if (currentTab === 'favorites') loadList('favorites');
                alert(`成功导入 ${imported.length} 条记录`);
            } else {
                alert('文件格式错误');
            }
        } catch (err) {
            console.error(err);
            alert('无法解析文件');
        }
        importInput.value = ''; // Reset
    };
    reader.readAsText(file);
});

// Modal Actions
const closeModal = () => favModal.classList.add('hidden');

closeFavModal.addEventListener('click', closeModal);
cancelFavBtn.addEventListener('click', closeModal);

confirmFavBtn.addEventListener('click', () => {
    const url = favUrlDisplay.textContent.trim();
    const note = favNote.value.trim();
    
    addToStorage(STORAGE_KEYS.FAVORITES, url, note);
    if (currentTab === 'favorites') loadList('favorites');
    
    updateFavoriteBtnState(url); // Update button state
    
    closeModal();
    updateStatus('success', '已添加到收藏');
});

// Close modal on outside click
favModal.addEventListener('click', (e) => {
    if (e.target === favModal) closeModal();
});



// Functions

function playVideo(url) {
    updateFavoriteBtnState(url);
    
    if (Hls.isSupported()) {
        if (hls) {
            hls.destroy();
        }
        
        showLoading(true);
        updateStatus('loading', '正在加载视频资源...');
        
        // 自定义 loader：使用 fetch + no-referrer 策略，绕过服务器 Referer 校验
        function createNoRefererLoader() {
            function CustomLoader(config) {
                // 完全自定义 loader，不继承默认 XHR loader
                var loadUrl = null;
                var aborter = null;
                
                function destroy() {
                    if (aborter) {
                        aborter.abort();
                        aborter = null;
                    }
                }
                
                function abort() {
                    destroy();
                }
                
                return {
                    destroy: destroy,
                    abort: abort,
                    load: function(context, loadConfig, callbacks) {
                        loadUrl = context.url;
                        aborter = new AbortController();
                        
                        var fetchOptions = {
                            method: 'GET',
                            mode: 'cors',
                            credentials: 'omit',
                            referrerPolicy: 'no-referrer',
                            signal: aborter.signal
                        };
                        
                        fetch(loadUrl, fetchOptions)
                            .then(function(response) {
                                if (!response.ok) {
                                    throw new Error('HTTP ' + response.status);
                                }
                                var total = parseInt(response.headers.get('Content-Length') || '0');
                                if (callbacks.onprogress) {
                                    callbacks.onprogress(null, {total: total, loaded: 0}, context, null);
                                }
                                return response.arrayBuffer();
                            })
                            .then(function(buffer) {
                                var stats = {
                                    total: buffer.byteLength,
                                    loaded: buffer.byteLength,
                                    aborted: false
                                };
                                if (callbacks.onprogress) {
                                    callbacks.onprogress(null, stats, context, null);
                                }
                                if (callbacks.onSuccess) {
                                    callbacks.onSuccess(
                                        {url: loadUrl, data: buffer},
                                        stats,
                                        context,
                                        null
                                    );
                                }
                            })
                            .catch(function(err) {
                                if (err.name === 'AbortError') return;
                                var stats = {total: 0, loaded: 0, aborted: false};
                                if (callbacks.onError) {
                                    callbacks.onError(
                                        {code: 0, text: err.message || 'Network error'},
                                        stats,
                                        context,
                                        null
                                    );
                                }
                            });
                    },
                    get stats() {
                        return {total: 0, loaded: 0, aborted: false};
                    }
                };
            }
            return CustomLoader;
        }
        
        hls = new Hls({
            debug: false,
            enableWorker: false,
            loader: createNoRefererLoader()
        });
        
        hls.loadSource(url);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            showLoading(false);
            playerMessage.style.display = 'none';
            video.play().catch(e => {
                console.log('Autoplay prevented', e);
                updateStatus('warning', '就绪 (需手动播放)');
            });
            updateStatus('success', '播放中');
            addToStorage(STORAGE_KEYS.HISTORY, url);
            if (currentTab === 'history') loadList('history');
        });
        
        hls.on(Hls.Events.ERROR, function(event, data) {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.error('Network error encountered', data);
                        hls.destroy();
                        showLoading(false);
                        updateStatus('error', '网络错误，服务器拒绝了请求');
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.error('Media error encountered');
                        hls.recoverMediaError();
                        updateStatus('error', '媒体错误，尝试恢复...');
                        break;
                    default:
                        hls.destroy();
                        showLoading(false);
                        updateStatus('error', '无法播放此视频');
                        break;
                }
            }
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', function() {
            playerMessage.style.display = 'none';
            video.play();
            updateStatus('success', '播放中');
            addToStorage(STORAGE_KEYS.HISTORY, url);
            if (currentTab === 'history') loadList('history');
        });
        video.addEventListener('error', function() {
            updateStatus('error', '无法播放此视频');
        });
    } else {
        alert('您的浏览器不支持 HLS 播放');
        updateStatus('error', '浏览器不支持 HLS');
    }
}

function showLoading(show) {
    loadingSpinner.style.display = show ? 'flex' : 'none';
    if (show) playerMessage.style.display = 'none';
}

function updateStatus(type, text) {
    statusText.textContent = text;
    statusIndicator.className = 'w-2 h-2 rounded-full mr-2';
    
    switch(type) {
        case 'success':
            statusIndicator.classList.add('bg-green-500', 'shadow-[0_0_10px_rgba(34,197,94,0.5)]');
            break;
        case 'error':
            statusIndicator.classList.add('bg-red-500', 'shadow-[0_0_10px_rgba(239,68,68,0.5)]');
            break;
        case 'loading':
            statusIndicator.classList.add('bg-yellow-500', 'animate-pulse');
            break;
        default:
            statusIndicator.classList.add('bg-slate-500');
    }
}

function switchTab(tab) {
    currentTab = tab;
    
    // Update Tab Styles
    if (tab === 'history') {
        tabHistory.classList.replace('text-slate-400', 'text-white');
        tabHistory.classList.replace('hover:text-white', 'bg-slate-800');
        tabHistory.classList.add('shadow-sm');
        
        tabFavorites.classList.replace('text-white', 'text-slate-400');
        tabFavorites.classList.replace('bg-slate-800', 'hover:text-white');
        tabFavorites.classList.remove('shadow-sm');
        
        listTitle.textContent = '最近播放';
    } else {
        tabFavorites.classList.replace('text-slate-400', 'text-white');
        tabFavorites.classList.replace('hover:text-white', 'bg-slate-800');
        tabFavorites.classList.add('shadow-sm');
        
        tabHistory.classList.replace('text-white', 'text-slate-400');
        tabHistory.classList.replace('bg-slate-800', 'hover:text-white');
        tabHistory.classList.remove('shadow-sm');
        
        listTitle.textContent = '收藏夹';
    }
    
    loadList(tab);
}

function getStorage(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}

function addToStorage(key, url, note = '') {
    let list = getStorage(key);
    // Remove if exists (to move to top)
    list = list.filter(item => item.url !== url);
    
    // Add new
    list.unshift({
        url: url,
        timestamp: new Date().getTime(),
        title: note || url.split('/').pop() || '未命名视频'
    });
    
    // Limit to 50
    if (list.length > 50) list.pop();
    
    localStorage.setItem(key, JSON.stringify(list));
}

function loadList(type) {
    const key = type === 'history' ? STORAGE_KEYS.HISTORY : STORAGE_KEYS.FAVORITES;
    const list = getStorage(key);
    
    playlistContainer.innerHTML = '';
    
    if (list.length === 0) {
        playlistContainer.innerHTML = `
            <div class="text-center py-10 text-slate-600">
                <i class="fas fa-inbox text-3xl mb-3 opacity-50"></i>
                <p class="text-sm">暂无记录</p>
            </div>
        `;
        return;
    }
    
    list.forEach(item => {
        const el = document.createElement('div');
        el.className = 'group flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/5';
        
        let actionButtons = '';
        if (type === 'favorites') {
            actionButtons += `
            <button class="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-blue-400 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all edit-btn" title="编辑备注">
                <i class="fas fa-edit"></i>
            </button>`;
        }
        actionButtons += `
            <button class="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-red-400 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all delete-btn" title="删除">
                <i class="fas fa-times"></i>
            </button>`;

        el.innerHTML = `
            <div class="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-primary transition-colors">
                <i class="fas fa-play text-xs"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-slate-300 truncate group-hover:text-white">${item.title}</div>
                <div class="text-xs text-slate-600 truncate">${item.url}</div>
            </div>
            <div class="flex items-center gap-1">
                ${actionButtons}
            </div>
        `;
        
        // Play click
        el.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                m3u8UrlInput.value = item.url;
                playVideo(item.url);
            }
        });
        
        // Edit click
        const editBtn = el.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                favUrlDisplay.textContent = item.url;
                favNote.value = item.title;
                favModal.classList.remove('hidden');
                favNote.focus();
            });
        }
        
        // Delete click
        el.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromStorage(key, item.url);
            loadList(type);
        });
        
        playlistContainer.appendChild(el);
    });
}

function removeFromStorage(key, url) {
    let list = getStorage(key);
    list = list.filter(item => item.url !== url);
    localStorage.setItem(key, JSON.stringify(list));
    
    // Update button state if removing current video from favorites
    if (key === STORAGE_KEYS.FAVORITES) {
        const currentUrl = m3u8UrlInput.value.trim();
        if (currentUrl === url) {
            updateFavoriteBtnState(url);
        }
    }
}

function updateFavoriteBtnState(url) {
    if (!url) return;
    
    const favorites = getStorage(STORAGE_KEYS.FAVORITES);
    const isFavorite = favorites.some(item => item.url === url);
    
    const icon = btnFavorite.querySelector('i');
    const text = btnFavorite.querySelector('span');
    
    if (isFavorite) {
        btnFavorite.classList.add('text-yellow-500');
        icon.classList.replace('far', 'fas');
        text.textContent = '已收藏';
    } else {
        btnFavorite.classList.remove('text-yellow-500');
        icon.classList.replace('fas', 'far');
        text.textContent = '收藏';
    }
}
