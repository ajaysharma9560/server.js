const socket = io();
let frameCount = 0;
let lastFpsUpdate = Date.now();
let isStreaming = false;
let selectedDeviceId = null;
let devicesData = [];

// DOM Elements
const video = document.getElementById('video');
const placeholder = document.getElementById('placeholder');
const deviceCountSpan = document.getElementById('deviceCount');
const fpsCountSpan = document.getElementById('fpsCount');
const devicesList = document.getElementById('devicesList');
const fpsSlider = document.getElementById('fpsSlider');
const fpsLabel = document.getElementById('fpsLabel');
const selectedDeviceLabel = document.getElementById('selectedDeviceLabel');
const videoContainer = document.getElementById('videoContainer');
const fullscreenBtn = document.getElementById('fullscreenBtn');

// ========== FULLSCREEN ==========
fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        videoContainer.requestFullscreen().catch(err => console.log(err));
    } else {
        document.exitFullscreen();
    }
});

document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
        videoContainer.classList.add('fullscreen');
    } else {
        videoContainer.classList.remove('fullscreen');
    }
});

// ========== SOCKET EVENTS ==========

socket.on('connect', () => {
    console.log('✅ Connected to server');
});

socket.on('frame', (data) => {
    if (data && data.image && isStreaming) {
        video.src = 'data:image/jpeg;base64,' + data.image;
        video.style.display = 'block';
        placeholder.style.display = 'none';
        
        frameCount++;
        const now = Date.now();
        if (now - lastFpsUpdate >= 1000) {
            fpsCountSpan.textContent = frameCount;
            frameCount = 0;
            lastFpsUpdate = now;
        }
    }
});

socket.on('devices_list', (devices) => {
    devicesData = devices;
    deviceCountSpan.textContent = devices.length;
    
    if (devices.length === 0) {
        devicesList.innerHTML = '<div class="empty-devices">No devices connected</div>';
        video.style.display = 'none';
        placeholder.style.display = 'block';
        isStreaming = false;
        selectedDeviceLabel.innerHTML = 'Select a device to view';
    } else {
        devicesList.innerHTML = devices.map(device => `
            <div class="device-item ${selectedDeviceId === device.id ? 'active' : ''}" onclick="selectDevice('${device.id}')">
                <div>
                    <span class="device-name">📱 ${device.name}</span>
                    ${selectedDeviceId === device.id ? '<span class="device-badge">VIEWING</span>' : ''}
                </div>
                <div class="device-status"></div>
            </div>
        `).join('');
    }
});

socket.on('selected_device', (deviceId) => {
    selectedDeviceId = deviceId;
    const device = devicesData.find(d => d.id === deviceId);
    if (device) {
        selectedDeviceLabel.innerHTML = `Viewing: ${device.name}`;
    }
    
    document.querySelectorAll('.device-item').forEach(el => {
        el.classList.remove('active');
    });
    const activeEl = document.querySelector(`.device-item[onclick="selectDevice('${deviceId}')"]`);
    if (activeEl) activeEl.classList.add('active');
});

socket.on('status_update', (status) => {
    isStreaming = status.stream;
    const serverStatus = document.getElementById('serverStatus');
    if (status.stream) {
        serverStatus.innerHTML = '● LIVE';
        serverStatus.style.color = '#f44336';
        serverStatus.classList.add('streaming');
    } else {
        serverStatus.innerHTML = '● Online';
        serverStatus.style.color = '#4CAF50';
        serverStatus.classList.remove('streaming');
    }
});

// ========== FUNCTIONS ==========

window.selectDevice = function(deviceId) {
    console.log('Selecting device:', deviceId);
    socket.emit('select_device', { deviceId: deviceId });
    isStreaming = false;
    video.style.display = 'none';
    placeholder.style.display = 'block';
    fpsCountSpan.textContent = '0';
};

function sendCommand(command, value = null) {
    if (!selectedDeviceId) {
        console.log('No device selected');
        return;
    }
    socket.emit('command', { command, value });
    console.log('Command sent:', command, value);
}

// ========== BUTTON EVENTS ==========

document.getElementById('startBtn').onclick = () => {
    sendCommand('start');
    isStreaming = true;
};

document.getElementById('stopBtn').onclick = () => {
    sendCommand('stop');
    isStreaming = false;
    video.style.display = 'none';
    placeholder.style.display = 'block';
    fpsCountSpan.textContent = '0';
};

document.getElementById('flipBtn').onclick = () => sendCommand('flip');

// Quality buttons
document.querySelectorAll('.quality-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const quality = parseInt(btn.dataset.quality);
        sendCommand('quality', quality);
    };
});

// FPS Slider
fpsSlider.oninput = () => {
    const fps = parseInt(fpsSlider.value);
    fpsLabel.textContent = fps + ' FPS';
    sendCommand('fps', fps);
};

console.log('Page loaded, waiting for devices...');
