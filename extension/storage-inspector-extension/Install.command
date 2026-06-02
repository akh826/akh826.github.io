#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ ! -f "$DIR/manifest.json" ]]; then
  echo "Storage Inspector folder is incomplete. Extract the full ZIP first."
  read -r -p "Press Enter to close..."
  exit 1
fi

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
EDGE="/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"

if [[ -x "$CHROME" ]]; then
  open -na "Google Chrome" --args --load-extension="$DIR"
  echo "Storage Inspector loaded in Chrome for this session."
elif [[ -x "$EDGE" ]]; then
  open -na "Microsoft Edge" --args --load-extension="$DIR"
  echo "Storage Inspector loaded in Edge for this session."
else
  echo "Chrome or Edge not found."
  echo "Manual install: open chrome://extensions, Developer mode, Load unpacked:"
  echo "  $DIR"
  read -r -p "Press Enter to close..."
  exit 1
fi

echo "Pin the extension from the toolbar puzzle menu."
read -r -p "Press Enter to close..."
