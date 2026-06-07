const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Store state
let connectedDevices = [];
let activeStream = false;
let currentQuality = 240;
let currentFps = 15;
let selectedDeviceId = null;

io.on('connection', (socket) => {
  console.log('📱 New connection:', socket.id);
  
  // ========== ANDROID DEVICE EVENTS ==========
  
  socket.on('register_device', (data) => {
    const device = {
      id: socket.id,
      name: data.deviceName || "Android Device",
      model: data.model || "Unknown",
      camera: data.camera || "back",
      status: 'online',
      connectedAt: new Date().toLocaleTimeString(),
      cameraPermission: data.cameraPermission || false
    };
    
    const existingIndex = connectedDevices.findIndex(d => d.id === socket.id);
    if (existingIndex >= 0) {
      connectedDevices[existingIndex] = device;
    } else {
      connectedDevices.push(device);
    }
    
    if (!selectedDeviceId) {
      selectedDeviceId = socket.id;
    }
    
    console.log(`✅ Device registered: ${device.name}`);
    console.log(`📊 Total devices: ${connectedDevices.length}`);
    console.log(`📷 Camera Permission: ${device.cameraPermission ? 'GRANTED' : 'NOT GRANTED'}`);
    
    io.emit('devices_list', connectedDevices);
    io.emit('selected_device', selectedDeviceId);
    
    socket.emit('settings', {
      quality: currentQuality,
      fps: currentFps,
      stream: activeStream
    });
    
    io.emit('status_update', {
      devices: connectedDevices.length,
      stream: activeStream,
      quality: currentQuality,
      fps: currentFps,
      selectedDevice: selectedDeviceId
    });
  });
  
  socket.on('stream_frame', (data) => {
    if (data && data.image && activeStream && selectedDeviceId === socket.id) {
      io.emit('frame', {
        image: data.image,
        timestamp: Date.now(),
        quality: data.quality || currentQuality,
        fps: data.fps || currentFps
      });
    }
  });
  
  socket.on('select_device', (data) => {
    const deviceId = data.deviceId;
    const device = connectedDevices.find(d => d.id === deviceId);
    if (device) {
      selectedDeviceId = deviceId;
      console.log(`🖱️ Selected device: ${device.name}`);
      io.emit('selected_device', selectedDeviceId);
      io.emit('status_update', {
        devices: connectedDevices.length,
        stream: activeStream,
        quality: currentQuality,
        fps: currentFps,
        selectedDevice: selectedDeviceId
      });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Device disconnected:', socket.id);
    connectedDevices = connectedDevices.filter(d => d.id !== socket.id);
    
    if (selectedDeviceId === socket.id && connectedDevices.length > 0) {
      selectedDeviceId = connectedDevices[0].id;
      io.emit('selected_device', selectedDeviceId);
    } else if (connectedDevices.length === 0) {
      selectedDeviceId = null;
    }
    
    io.emit('devices_list', connectedDevices);
    io.emit('status_update', {
      devices: connectedDevices.length,
      stream: activeStream,
      quality: currentQuality,
      fps: currentFps,
      selectedDevice: selectedDeviceId
    });
    console.log(`📊 Remaining devices: ${connectedDevices.length}`);
  });
  
  // ========== WEB COMMAND HANDLER ==========
  
  socket.on('command', (data) => {
    const { command, value } = data;
    console.log(`🎮 Command: ${command} ${value ? '= ' + value : ''}`);
    
    switch(command) {
      case 'start':
        activeStream = true;
        console.log('▶ Stream STARTED');
        break;
      case 'stop':
        activeStream = false;
        console.log('⏹ Stream STOPPED');
        break;
      case 'flip':
        console.log('🔄 Flip camera');
        break;
      case 'quality':
        currentQuality = value;
        console.log(`🎨 Quality: ${value}p`);
        break;
      case 'fps':
        currentFps = value;
        console.log(`⚡ FPS: ${value}`);
        break;
    }
    
    if (selectedDeviceId) {
      io.to(selectedDeviceId).emit('command', { command, value });
    }
    
    io.emit('status_update', {
      devices: connectedDevices.length,
      stream: activeStream,
      quality: currentQuality,
      fps: currentFps,
      selectedDevice: selectedDeviceId
    });
  });
  
  // Send initial data to new web client
  socket.emit('devices_list', connectedDevices);
  socket.emit('selected_device', selectedDeviceId);
  socket.emit('status_update', {
    devices: connectedDevices.length,
    stream: activeStream,
    quality: currentQuality,
    fps: currentFps,
    selectedDevice: selectedDeviceId
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    devices: connectedDevices.length,
    streamActive: activeStream,
    quality: currentQuality,
    fps: currentFps,
    selectedDevice: selectedDeviceId,
    uptime: process.uptime()
  });
});

// All other routes serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('✅ Ludoo Camera Remote Server Started');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🌐 Web Interface: http://localhost:${PORT}`);
  console.log(`💪 Health Check: http://localhost:${PORT}/health`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('📱 Features:');
  console.log('   • Multi-device support');
  console.log('   • Click to select device');
  console.log('   • START/STOP/FLIP controls');
  console.log('   • 4 Qualities: 120p, 140p, 240p, 360p');
  console.log('   • FPS Control: 5-30 FPS');
  console.log('   • Fullscreen button');
  console.log('   • Device shows ONLINE immediately');
  console.log('');
  console.log('📡 Waiting for Android device...');
  console.log('');
});
