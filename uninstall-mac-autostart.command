#!/bin/zsh
set -e

PLIST="$HOME/Library/LaunchAgents/vc.skyland.token-meter.plist"

launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"

echo "Token Meter の自動起動を解除しました。"
