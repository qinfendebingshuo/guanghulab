// HoloLake 动态漫制作系统 - 环节6 (预览与分享版)
// 基于环节5增强，新增预览模式、分享链接、嵌入代码功能

// ==================== 全局变量 ====================
let scenes = [
    {
        id: 'scene-1',
        name: '场景1',
        frames: [
            {
                id: 'frame-1-1',
                assets: []  // 存储素材 { id, type, emoji, x, y, width, height }
            }
        ]
    }
];
let currentSceneIndex = 0;
let currentFrameIndex = 0;
let animationInterval = null;
let isPlaying = false;
let fps = 4;
let canvas = document.getElementById('mainCanvas');
let ctx = canvas.getContext('2d');

// ==================== 初始化 ====================
function init() {
    console.log('HoloLake 动态漫制作系统 v6.0 初始化...');
    updateUI();
    setupEventListeners();
    drawCurrentFrame();
}

// ==================== 事件监听设置 ====================
function setupEventListeners() {
    // FPS滑块
    const fpsSlider = document.getElementById('fpsSlider');
    if (fpsSlider) {
        fpsSlider.addEventListener('input', function(e) {
            fps = parseInt(e.target.value);
            document.getElementById('fpsValue').textContent = fps + ' FPS';
            if (isPlaying) {
                stopAnimation();
                startAnimation();
            }
        });
    }
    
    // 预览按钮
    const previewBtn = document.getElementById('previewBtn');
    if (previewBtn) {
        previewBtn.addEventListener('click', enterPreviewMode);
    }
    
    // 预览模式按钮
    const playPreviewBtn = document.getElementById('playPreviewBtn');
    if (playPreviewBtn) {
        playPreviewBtn.addEventListener('click', function() {
            if (!isPlaying) {
                startAnimation();
            }
        });
    }
    
    const pausePreviewBtn = document.getElementById('pausePreviewBtn');
    if (pausePreviewBtn) {
        pausePreviewBtn.addEventListener('click', function() {
            if (isPlaying) {
                stopAnimation();
            }
        });
    }
    
    const stopPreviewBtn = document.getElementById('stopPreviewBtn');
    if (stopPreviewBtn) {
        stopPreviewBtn.addEventListener('click', function() {
            stopAnimation();
            currentFrameIndex = 0;
            updateUI();
            drawCurrentFrame();
        });
    }
    
    const exitPreviewBtn = document.getElementById('exitPreviewBtn');
    if (exitPreviewBtn) {
        exitPreviewBtn.addEventListener('click', exitPreviewMode);
    }
    
    // 分享按钮
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', showSharePanel);
    }
    
    // 分享面板按钮
    const generateUrlBtn = document.getElementById('generateUrlBtn');
    if (generateUrlBtn) {
        generateUrlBtn.addEventListener('click', generateShareUrl);
    }
    
    const generateEmbedBtn = document.getElementById('generateEmbedBtn');
    if (generateEmbedBtn) {
        generateEmbedBtn.addEventListener('click', generateEmbedCode);
    }
    
    const closeShareBtn = document.getElementById('closeShareBtn');
    if (closeShareBtn) {
        closeShareBtn.addEventListener('click', hideSharePanel);
    }
    
    const copyShareBtn = document.getElementById('copyShareBtn');
    if (copyShareBtn) {
        copyShareBtn.addEventListener('click', copyToClipboard);
    }
    
    // 素材拖拽
    const materialItems = document.querySelectorAll('.material-item');
    materialItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
    });
    
    // 画布放置
    canvas.addEventListener('dragover', (e) => e.preventDefault());
    canvas.addEventListener('drop', handleDrop);
    
    // 画布点击选择素材
    canvas.addEventListener('click', handleCanvasClick);
}

// ==================== 素材拖拽 ====================
function handleDragStart(e) {
    const type = e.target.dataset.type;
    const emoji = e.target.dataset.emoji;
    e.dataTransfer.setData('text/plain', JSON.stringify({
        type: type,
        emoji: emoji
    }));
}

// ==================== 素材放置 ====================
function handleDrop(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        
        const currentScene = scenes[currentSceneIndex];
        const currentFrame = currentScene.frames[currentFrameIndex];
        
        const newAsset = {
            id: 'asset-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            type: data.type,
            emoji: data.emoji,
            x: x - 25,
            y: y - 25,
            width: 50,
            height: 50
        };
        
        currentFrame.assets.push(newAsset);
        drawCurrentFrame();
        updateUI();
    } catch (error) {
        console.error('放置素材失败:', error);
    }
}

// ==================== 画布点击选择 ====================
function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    
    const currentScene = scenes[currentSceneIndex];
    const currentFrame = currentScene.frames[currentFrameIndex];
    
    // 从后往前遍历，以便选中上层的素材
    let selectedAsset = null;
    for (let i = currentFrame.assets.length - 1; i >= 0; i--) {
        const asset = currentFrame.assets[i];
        if (clickX >= asset.x && clickX <= asset.x + asset.width &&
            clickY >= asset.y && clickY <= asset.y + asset.height) {
            selectedAsset = asset;
            break;
        }
    }
    
    // 移除所有选中状态
    currentFrame.assets.forEach(a => delete a.selected);
    
    // 设置新的选中状态
    if (selectedAsset) {
        selectedAsset.selected = true;
    }
    
    drawCurrentFrame();
}

// ==================== 绘制当前帧 ====================
function drawCurrentFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const currentScene = scenes[currentSceneIndex];
    if (!currentScene) return;
    
    const currentFrame = currentScene.frames[currentFrameIndex];
    if (!currentFrame) return;
    
    // 绘制背景色
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制所有素材
    currentFrame.assets.forEach(asset => {
        ctx.font = '40px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(asset.emoji, asset.x + asset.width/2, asset.y + asset.height/2);
        
        // 如果被选中，绘制边框
        if (asset.selected) {
            ctx.strokeStyle = '#e94560';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(asset.x, asset.y, asset.width, asset.height);
            ctx.setLineDash([]);
        }
    });
}

// ==================== 场景管理 ====================
function addScene() {
    const newScene = {
        id: 'scene-' + Date.now(),
        name: '场景' + (scenes.length + 1),
        frames: [
            {
                id: 'frame-' + Date.now() + '-1',
                assets: []
            }
        ]
    };
    scenes.push(newScene);
    currentSceneIndex = scenes.length - 1;
    currentFrameIndex = 0;
    updateUI();
    drawCurrentFrame();
}

// ==================== 帧管理 ====================
function addFrame() {
    const currentScene = scenes[currentSceneIndex];
    const currentFrame = currentScene.frames[currentFrameIndex];
    
    // 深拷贝当前帧的素材
    const newAssets = JSON.parse(JSON.stringify(currentFrame.assets));
    // 移除选中状态
    newAssets.forEach(a => delete a.selected);
    
    const newFrame = {
        id: 'frame-' + Date.now(),
        assets: newAssets
    };
    
    currentScene.frames.splice(currentFrameIndex + 1, 0, newFrame);
    currentFrameIndex++;
    updateUI();
    drawCurrentFrame();
}

function deleteFrame() {
    const currentScene = scenes[currentSceneIndex];
    if (currentScene.frames.length <= 1) {
        alert('每个场景至少保留一帧');
        return;
    }
    
    currentScene.frames.splice(currentFrameIndex, 1);
    if (currentFrameIndex >= currentScene.frames.length) {
        currentFrameIndex = currentScene.frames.length - 1;
    }
    updateUI();
    drawCurrentFrame();
}

// ==================== 动画控制 ====================
function togglePlayback() {
    if (isPlaying) {
        stopAnimation();
    } else {
        startAnimation();
    }
}

function startAnimation() {
    if (isPlaying) return;
    isPlaying = true;
    updatePlayButton();
    
    animationInterval = setInterval(() => {
        const currentScene = scenes[currentSceneIndex];
        if (currentFrameIndex < currentScene.frames.length - 1) {
            currentFrameIndex++;
        } else {
            currentFrameIndex = 0;
        }
        updateUI();
        drawCurrentFrame();
    }, 1000 / fps);
}

function stopAnimation() {
    if (animationInterval) {
        clearInterval(animationInterval);
        animationInterval = null;
    }
    isPlaying = false;
    updatePlayButton();
}

function updatePlayButton() {
    const playBtn = document.getElementById('timelinePlayBtn');
    if (playBtn) {
        playBtn.textContent = isPlaying ? '⏸️ 暂停' : '▶️ 播放';
    }
    
    const previewPlayBtn = document.getElementById('playPreviewBtn');
    if (previewPlayBtn) {
        // 预览模式的播放按钮文字不变
    }
}

// ==================== 预览模式 ====================
function enterPreviewMode() {
    document.body.classList.add('preview-mode');
    // 如果正在播放动画，继续播放
}

function exitPreviewMode() {
    document.body.classList.remove('preview-mode');
}

// ==================== 分享功能 ====================
function showSharePanel() {
    document.getElementById('shareOverlay').classList.remove('hidden');
    document.getElementById('sharePanel').classList.remove('hidden');
}

function hideSharePanel() {
    document.getElementById('shareOverlay').classList.add('hidden');
    document.getElementById('sharePanel').classList.add('hidden');
    document.getElementById('shareUrl').innerHTML = '';
    document.getElementById('copyShareBtn').style.display = 'none';
}

function generateShareUrl() {
    // 序列化作品数据
    const workData = {
        scenes: scenes,
        version: '1.0',
        timestamp: Date.now()
    };
    
    const jsonStr = JSON.stringify(workData);
    // 使用encodeURIComponent编码，然后生成Data URL
    const encodedData = encodeURIComponent(jsonStr);
    const dataUrl = 'data:text/json;charset=utf-8,' + encodedData;
    
    // 显示分享链接
    const shareUrlDiv = document.getElementById('shareUrl');
    shareUrlDiv.innerHTML = `<a href="${dataUrl}" target="_blank">${dataUrl.substring(0, 50)}...</a>`;
    
    document.getElementById('copyShareBtn').style.display = 'inline-block';
    document.getElementById('copyShareBtn').dataset.url = dataUrl;
}

function generateEmbedCode() {
    // 生成iframe嵌入代码
    const embedCode = `<iframe src="preview-player.html" width="800" height="450" frameborder="0" allowfullscreen></iframe>`;
    
    const shareUrlDiv = document.getElementById('shareUrl');
    shareUrlDiv.innerHTML = `<pre style="white-space: pre-wrap; background:#0a0a14; padding:10px; border-radius:8px;">${embedCode}</pre>`;
    
    document.getElementById('copyShareBtn').style.display = 'inline-block';
    document.getElementById('copyShareBtn').dataset.code = embedCode;
}

function copyToClipboard(e) {
    const btn = e.target;
    if (btn.dataset.url) {
        navigator.clipboard.writeText(btn.dataset.url);
    } else if (btn.dataset.code) {
        navigator.clipboard.writeText(btn.dataset.code);
    }
    alert('已复制到剪贴板！');
}

// ==================== 导入导出 ====================
function exportScene() {
    const dataStr = JSON.stringify(scenes, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hololake-scene.json';
    a.click();
    
    URL.revokeObjectURL(url);
}

function importScene(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedScenes = JSON.parse(e.target.result);
            if (Array.isArray(importedScenes) && importedScenes.length > 0) {
                scenes = importedScenes;
                currentSceneIndex = 0;
                currentFrameIndex = 0;
                updateUI();
                drawCurrentFrame();
                alert('导入成功！');
            } else {
                alert('无效的场景数据');
            }
        } catch (error) {
            alert('导入失败：' + error.message);
        }
    };
    reader.readAsText(file);
    
    // 清空input，以便再次导入同一个文件
    event.target.value = '';
}

function exportScreenshot() {
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'hololake-screenshot-' + Date.now() + '.png';
    a.click();
}

// ==================== 更新UI ====================
function updateUI() {
    // 更新场景列表
    const sceneList = document.getElementById('sceneList');
    if (sceneList) {
        sceneList.innerHTML = '';
        scenes.forEach((scene, index) => {
            const sceneDiv = document.createElement('div');
            sceneDiv.className = 'scene-item' + (index === currentSceneIndex ? ' active' : '');
            sceneDiv.innerHTML = `
                <span>${scene.name}</span>
                <button onclick="deleteScene(${index})" style="background:none; border:none; color:#e94560; cursor:pointer;">✖️</button>
            `;
            sceneDiv.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') {
                    switchScene(index);
                }
            });
            sceneList.appendChild(sceneDiv);
        });
    }
    
    // 更新帧列表
    const framesContainer = document.getElementById('framesContainer');
    if (framesContainer && scenes[currentSceneIndex]) {
        framesContainer.innerHTML = '';
        scenes[currentSceneIndex].frames.forEach((frame, index) => {
            const frameDiv = document.createElement('div');
            frameDiv.className = 'frame-thumb' + (index === currentFrameIndex ? ' active' : '');
            frameDiv.innerHTML = `
                <div class="frame-index">${index + 1}</div>
                <div>${frame.assets.length}个素材</div>
            `;
            frameDiv.addEventListener('click', () => {
                currentFrameIndex = index;
                drawCurrentFrame();
                updateUI();
            });
            framesContainer.appendChild(frameDiv);
        });
    }
    
    // 更新帧计数器
    const frameCounter = document.getElementById('frame-counter');
    if (frameCounter && scenes[currentSceneIndex]) {
        frameCounter.textContent = `帧 ${currentFrameIndex + 1}/${scenes[currentSceneIndex].frames.length}`;
    }
}

function switchScene(index) {
    if (index >= 0 && index < scenes.length) {
        currentSceneIndex = index;
        currentFrameIndex = 0;
        if (isPlaying) {
            stopAnimation();
        }
        updateUI();
        drawCurrentFrame();
    }
}

function deleteScene(index) {
    if (scenes.length <= 1) {
        alert('至少保留一个场景');
        return;
    }
    
    scenes.splice(index, 1);
    if (currentSceneIndex >= scenes.length) {
        currentSceneIndex = scenes.length - 1;
    }
    currentFrameIndex = 0;
    if (isPlaying) {
        stopAnimation();
    }
    updateUI();
    drawCurrentFrame();
}

// ==================== 启动初始化 ====================
window.onload = init;
