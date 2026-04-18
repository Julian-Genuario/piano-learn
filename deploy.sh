#!/bin/bash
# deploy.sh - Deploy PianoLearn to Raspberry Pi
# Usage: ./deploy.sh pi@pianolearn.local

set -e

PI_HOST="${1:-pi@pianolearn.local}"
REMOTE_DIR="/home/pi/piano-learn"

echo "Deploying PianoLearn to $PI_HOST..."

# Sync files
rsync -avz --exclude '.venv' --exclude '__pycache__' --exclude 'separated' \
    --exclude 'midi_extractor' --exclude '.git' --exclude 'tests' \
    ./ "$PI_HOST:$REMOTE_DIR/"

# Install dependencies and set up service
ssh "$PI_HOST" << 'EOF'
cd /home/pi/piano-learn
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-pi.txt

# Create systemd service
sudo tee /etc/systemd/system/pianolearn.service > /dev/null << 'SERVICE'
[Unit]
Description=PianoLearn Piano LED Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/pi/piano-learn
ExecStart=/home/pi/piano-learn/.venv/bin/python -m uvicorn pianolearn.server:app --host 0.0.0.0 --port 8000 --factory
Restart=always
RestartSec=5
Environment=PYTHONPATH=/home/pi/piano-learn

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable pianolearn
sudo systemctl restart pianolearn

echo "PianoLearn deployed! Access at http://$(hostname).local:8000"
EOF
