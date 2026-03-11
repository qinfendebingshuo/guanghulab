// ==================== HoloLake 动态漫制作系统 v5.0 ====================
// 环节5：动画时间轴（帧序列 + 播放控制 + 帧率调节）

const STORAGE_KEY = 'hololake-comic-studio-data';
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');

// ==================== 全局状态 ====================
let appState = {
    currentSceneId: 1,
    nextSceneId: 2,
    nextAssetId: 1,
    nextFrameId: 1,
    scenes: [],
    playback: {
        isPlaying: false,
        fps: 4,
        intervalId: null,
        currentFrameIndex: 0
    }
};

// ==================== 初始化 ====================
function init() {
    loadFromStorage();
    if (appState.scenes.length === 0) {
        createDefaultScene();
    }
    setupEventListeners();
    renderSceneTabs();
    renderCanvas();
    renderTimeline();
    updatePlaybackControls();
}

// 创建默认场景
function createDefaultScene() {
    const defaultScene = {
        id: 1,
        name: '场景 1',
        currentFrameIndex: 0,
        frames: [{
            id: 1,
            assets: []
        }],
        nextFrameId: 2
    };
    appState.scenes.push(defaultScene);
    appState.currentSceneId = 1;
    saveToStorage();
}

// ==================== 存储管理 ====================
function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function loadFromStorage() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        const parsed = JSON.parse(data);
        // 向后兼容：旧数据没有 frames 字段
        if (parsed.scenes && parsed.scenes.length > 0 && !parsed.scenes[0].frames) {
            parsed.scenes = parsed.scenes.map(scene => ({
                ...scene,
                currentFrameIndex: 0,
                frames: [{
                    id: 1,
                    assets: scene.assets || []
                }],
                nextFrameId: 2
            }));
            delete parsed.scenes[0].assets; // 删除旧的 assets 字段
        }
        // 确保 playback 对象存在
        if (!parsed.playback) {
            parsed.playback = { isPlaying: false, fps: 4, intervalId: null, currentFrameIndex: 0 };
        }
        appState = parsed;
    }
}

// ==================== 场景管理 ====================
function addScene() {
    const newScene = {
        id: appState.nextSceneId++,
        name: `场景 ${appState.scenes.length + 1}`,
        currentFrameIndex: 0,
        frames: [{
            id: 1,
            assets: []
        }],
        nextFrameId: 2
    };
    appState.scenes.push(newScene);
    appState.currentSceneId = newScene.id;
    saveToStorage();
    renderSceneTabs();
    renderCanvas();
    renderTimeline();
}

function switchScene(sceneId) {
    if (appState.playback.isPlaying) {
        stopAnimation();
    }
    appState.currentSceneId = sceneId;
    saveToStorage();
    renderSceneTabs();
    renderCanvas();
    renderTimeline();
    updateFrameCounter();
}

function deleteScene(sceneId) {
    if (appState.scenes.length <= 1) {
        alert('至少保留一个场景！');
        return;
    }
    appState.scenes = appState.scenes.filter(s => s.id !== sceneId);
    if (appState.currentSceneId === sceneId) {
        appState.currentSceneId = appState.scenes[0].id;
    }
    saveToStorage();
    renderSceneTabs();
    renderCanvas();
    renderTimeline();
}

function getCurrentScene() {
    return appState.scenes.find(s => s.id === appState.currentSceneId);
}

function getCurrentFrame() {
    const scene = getCurrentScene();
    if (!scene) return null;
    return scene.frames[scene.currentFrameIndex];
}// ==================== 帧管理 ====================
function addFrame() {
    const scene = getCurrentScene();
    if (!scene) return;
    
    // 深拷贝当前帧的素材状态
    const currentFrame = scene.frames[scene.currentFrameIndex];
    const newFrame = {
        id: scene.nextFrameId++,
        assets: JSON.parse(JSON.stringify(currentFrame.assets))
    };
    
    // 在当前帧后插入新帧
    scene.frames.splice(scene.currentFrameIndex + 1, 0, newFrame);
    scene.currentFrameIndex++;
    
    saveToStorage();
    renderTimeline();
    renderCanvas();
    updateFrameCounter();
}

function deleteFrame() {
    const scene = getCurrentScene();
    if (!scene) return;
    
    if (scene.frames.length <= 1) {
        alert('至少保留一帧！');
        return;
    }
    
    scene.frames.splice(scene.currentFrameIndex, 1);
    if (scene.currentFrameIndex >= scene.frames.length) {
        scene.currentFrameIndex = scene.frames.length - 1;
    }
    
    saveToStorage();
    renderTimeline();
    renderCanvas();
    updateFrameCounter();
}

function switchFrame(frameIndex) {
    const scene = getCurrentScene();
    if (!scene || frameIndex < 0 || frameIndex >= scene.frames.length) return;
    
    // 保存当前画布状态到当前帧
    captureFrame();
    
    scene.currentFrameIndex = frameIndex;
    saveToStorage();
    renderTimeline();
    renderCanvas();
    updateFrameCounter();
}

function captureFrame() {
    // 画布状态实时保存在 assets 中，无需额外操作
    saveToStorage();
}

// ==================== 播放引擎 ====================
function playAnimation() {
    const scene = getCurrentScene();
    if (!scene || scene.frames.length <= 1) return;
    
    appState.playback.isPlaying = true;
    updatePlaybackControls();
    
    const intervalMs = 1000 / appState.playback.fps;
    
    appState.playback.intervalId = setInterval(() => {
        const scene = getCurrentScene();
        if (!scene) return;
        
        scene.currentFrameIndex++;
        if (scene.currentFrameIndex >= scene.frames.length) {
            scene.currentFrameIndex = 0; // 循环播放
        }
        
        renderCanvas();
        renderTimeline();
        updateFrameCounter();
        saveToStorage();
    }, intervalMs);
}

function pauseAnimation() {
    appState.playback.isPlaying = false;
    if (appState.playback.intervalId) {
        clearInterval(appState.playback.intervalId);
        appState.playback.intervalId = null;
    }
    updatePlaybackControls();
}

function stopAnimation() {
    pauseAnimation();
    const scene = getCurrentScene();
    if (scene) {
        scene.currentFrameIndex = 0;
        renderCanvas();
        renderTimeline();
        updateFrameCounter();
        saveToStorage();
    }
}

function togglePlayback() {
    if (appState.playback.isPlaying) {
        pauseAnimation();
    } else {
        playAnimation();
    }
}

function setFPS(fps) {
    appState.playback.fps = parseInt(fps);
    document.getElementById('fps-display').textContent = fps + ' FPS';
    saveToStorage();
    
    // 如果正在播放，重启定时器以应用新帧率
    if (appState.playback.isPlaying) {
        pauseAnimation();
        playAnimation();
    }
}

function updatePlaybackControls() {
    const btnPlay = document.getElementById('btn-play');
    if (appState.playback.isPlaying) {
        btnPlay.textContent = '⏸️';
        btnPlay.title = '暂停';
    } else {
        btnPlay.textContent = '▶️';
        btnPlay.title = '播放';
    }
}

function updateFrameCounter() {
    const scene = getCurrentScene();
    if (!scene) return;
    const counter = document.getElementById('frame-counter');
    counter.textContent = `帧 ${scene.currentFrameIndex + 1}/${scene.frames.length}`;
}// ==================== 渲染函数 ====================
function renderSceneTabs() {
    const tabsList = document.getElementById('tabs-list');
    tabsList.innerHTML = '';
    
    appState.scenes.forEach(scene => {
        const tab = document.createElement('div');
        tab.className = 'scene-tab' + (scene.id === appState.currentSceneId ? ' active' : '');
        tab.innerHTML = `
            ${scene.name}
            <span class="close-btn" onclick="event.stopPropagation(); deleteScene(${scene.id})">×</span>
        `;
        tab.onclick = () => switchScene(scene.id);
        tabsList.appendChild(tab);
    });
}

function renderTimeline() {
    const timelineFrames = document.getElementById('timeline-frames');
    timelineFrames.innerHTML = '';
    
    const scene = getCurrentScene();
    if (!scene) return;
    
    scene.frames.forEach((frame, index) => {
        const thumb = document.createElement('div');
        thumb.className = 'frame-thumb' + (index === scene.currentFrameIndex ? ' active' : '');
        thumb.setAttribute('data-frame', index + 1);
        thumb.textContent = `帧 ${index + 1}`;
        thumb.onclick = () => switchFrame(index);
        timelineFrames.appendChild(thumb);
    });
}

function renderCanvas() {
    // 清空画布
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const frame = getCurrentFrame();
    if (!frame) return;
    
    // 绘制所有素材
    frame.assets.forEach(asset => {
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 绘制阴影
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        ctx.fillText(asset.emoji, asset.x, asset.y);
        
        // 重置阴影
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // 如果是选中状态，绘制边框
        if (asset.selected) {
            ctx.strokeStyle = '#e94560';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(asset.x - 30, asset.y - 30, 60, 60);
            ctx.setLineDash([]);
        }
    });
}

// ==================== 素材拖放 ====================
function setupEventListeners() {
    // 素材库拖放
    const assetItems = document.querySelectorAll('.asset-item');
    assetItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('type', item.dataset.type);
            e.dataTransfer.setData('emoji', item.dataset.emoji);
        });
    });
    
    // 画布接收拖放
    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('type');
        const emoji = e.dataTransfer.getData('emoji');
        
        if (emoji) {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            addAssetToCanvas(emoji, x, y);
        }
    });
    
    // 画布点击选择/移动
    let isDragging = false;
    let dragStartX, dragStartY;
    let selectedAsset = null;
    
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const frame = getCurrentFrame();
        if (!frame) return;
        
        // 查找点击的素材（从后往前，优先选上层的）
        selectedAsset = null;
        for (let i = frame.assets.length - 1; i >= 0; i--) {
            const asset = frame.assets[i];
            const dist = Math.sqrt((x - asset.x) ** 2 + (y - asset.y) ** 2);
            if (dist < 30) {
                selectedAsset = asset;
                // 更新选中状态
                frame.assets.forEach(a => a.selected = false);
                asset.selected = true;
                isDragging = true;
                dragStartX = x - asset.x;
                dragStartY = y - asset.y;
                renderCanvas();
                break;
            }
        }
        
        // 如果没点到素材，取消所有选中
        if (!selectedAsset) {
            frame.assets.forEach(a => a.selected = false);
            renderCanvas();
        }
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging || !selectedAsset) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        selectedAsset.x = x - dragStartX;
        selectedAsset.y = y - dragStartY;
        
        // 边界限制
        selectedAsset.x = Math.max(30, Math.min(canvas.width - 30, selectedAsset.x));
        selectedAsset.y = Math.max(30, Math.min(canvas.height - 30, selectedAsset.y));
        
        renderCanvas();
    });
    
    canvas.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            saveToStorage();
        }
    });
    
    // 键盘删除
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const frame = getCurrentFrame();
            if (!frame) return;
            
            const selectedIndex = frame.assets.findIndex(a => a.selected);
            if (selectedIndex !== -1) {
                frame.assets.splice(selectedIndex, 1);
                renderCanvas();
                saveToStorage();
            }
        }
    });
    
    // 导入文件监听
    document.getElementById('import-file').addEventListener('change', handleImport);
}

function addAssetToCanvas(emoji, x, y) {
    const frame = getCurrentFrame();
    if (!frame) return;
    
    // 取消其他选中
    frame.assets.forEach(a => a.selected = false);
    
    const newAsset = {
        id: appState.nextAssetId++,
        type: 'emoji',
        emoji: emoji,
        x: x,
        y: y,
        selected: true
    };
    
    frame.assets.push(newAsset);
    renderCanvas();
    saveToStorage();
}// ==================== 导出导入 ====================
function exportScene() {
    const dataStr = JSON.stringify(appState, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `hololake-scene-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importScene() {
    document.getElementById('import-file').click();
}

function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            
            // 验证数据结构
            if (!imported.scenes || !Array.isArray(imported.scenes)) {
                throw new Error('无效的数据格式');
            }
            
            // 向后兼容处理
            imported.scenes = imported.scenes.map(scene => {
                if (!scene.frames) {
                    return {
                        ...scene,
                        currentFrameIndex: 0,
                        frames: [{
                            id: 1,
                            assets: scene.assets || []
                        }],
                        nextFrameId: 2
                    };
                }
                return scene;
            });
            
            if (!imported.playback) {
                imported.playback = { isPlaying: false, fps: 4, intervalId: null, currentFrameIndex: 0 };
            }
            
            appState = imported;
            saveToStorage();
            renderSceneTabs();
            renderCanvas();
            renderTimeline();
            updatePlaybackControls();
            updateFrameCounter();
            
            alert('导入成功！');
        } catch (err) {
            alert('导入失败：' + err.message);
        }
    };
    reader.readAsText(file);
    
    // 清空 input，允许重复导入同一文件
    e.target.value = '';
}

// ==================== 截图导出 ====================
function exportScreenshot() {
    // 临时取消选中状态
    const frame = getCurrentFrame();
    if (!frame) return;
    
    const originalSelected = frame.assets.map(a => a.selected);
    frame.assets.forEach(a => a.selected = false);
    renderCanvas();
    
    // 导出 PNG
    const link = document.createElement('a');
    link.download = `hololake-frame-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    
    // 恢复选中状态
    frame.assets.forEach((a, i) => {
        a.selected = originalSelected[i];
    });
    renderCanvas();
}

// ==================== 启动应用 ====================
document.addEventListener('DOMContentLoaded', init);
