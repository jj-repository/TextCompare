# Overview

v2.04 — Electron app for side-by-side text comparison. LCS diff, minimap navigation, VS Code dark theme.

## Files
- `electron-main.js` — main process (window, menu, updates, download)
- `preload.js` — context bridge IPC
- `index.html` — complete frontend (HTML + CSS + JS, no build step)
- `package.json` — deps + build config
- `icon.png`, `takodachi.webp` — app icon, settings mascot

## Features
- Positional side-by-side diff (only changed chars highlighted, text stays in place)
- Line-by-line highlighting, click-to-edit (double-click to return), minimap
- Ignore whitespace / case options
- File drag-and-drop, undo button, Clear All confirmation
- Window state persistence, settings modal (auto-update toggle, version info)
