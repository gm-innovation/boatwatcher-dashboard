#!/bin/bash
# Dock Check Local Server — Installation Script (Linux)

set -e

echo "=== Dock Check Local Server Setup ==="

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "Node.js not found. Installing via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "Node.js version: $(node -v)"

# Install dependencies
cd "$(dirname "$0")"
npm install

# Create data directories
mkdir -p data backups

# Create systemd service
SERVICE_FILE=/etc/systemd/system/dockcheck-server.service
WORK_DIR=$(pwd)

sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=Dock Check Local Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$WORK_DIR
ExecStart=$(which node) index.js
Restart=always
RestartSec=5
Environment=BW_DATA_DIR=$WORK_DIR/data
Environment=BW_BACKUP_DIR=$WORK_DIR/backups
Environment=BW_PORT=3001

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable dockcheck-server
sudo systemctl start dockcheck-server

echo ""
echo "=== Installation Complete ==="
echo "Server running on http://0.0.0.0:3001"
echo "Service: sudo systemctl status dockcheck-server"
echo "Logs:    sudo journalctl -u dockcheck-server -f"
