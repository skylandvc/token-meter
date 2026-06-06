#!/bin/zsh
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="$HOME/.token-meter-local"
PLIST="$HOME/Library/LaunchAgents/vc.skyland.token-meter.plist"
LOG_DIR="$HOME/Library/Logs/token-meter"

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR" "$INSTALL_DIR"
cp "$APP_DIR/server.py" "$INSTALL_DIR/server.py"
rm -rf "$INSTALL_DIR/static"
cp -R "$APP_DIR/static" "$INSTALL_DIR/static"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>vc.skyland.token-meter</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd "$INSTALL_DIR" &amp;&amp; PORT=8766 python3 server.py</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/stdout.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/stderr.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "Token Meter を自動起動に登録しました。"
echo "API: http://127.0.0.1:8766/api/usage"
