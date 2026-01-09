# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TextCompare** is an Electron desktop application for comparing text with side-by-side diff visualization. It features an optimized LCS (Longest Common Subsequence) algorithm, minimap navigation, and a VS Code-inspired dark theme.

**Version:** 2.2.2

## Files Structure

```
TextCompare/
├── electron-main.js       # Electron main process (window, menu, updates)
├── index.html             # Single-file frontend (HTML + CSS + JS)
├── package.json           # Dependencies and build config
├── icon.png               # Application icon
└── CLAUDE.md              # This file
```

## Running the Application

```bash
# Install dependencies
npm install

# Run in development
npm start

# Build for Linux
npm run build:linux

# Build for Windows
npm run build:win

# Build for all platforms
npm run build:all
```

## Architecture Overview

### Simple Two-File Design

- **electron-main.js**: Electron main process with window management, menus, and update checking
- **index.html**: Complete frontend in a single file (1500+ lines of HTML/CSS/JS)

### Key Features

- Side-by-side text comparison
- Line-by-line diff highlighting
- Minimap for navigation
- Ignore whitespace option
- Ignore case option
- File drag-and-drop
- Window state persistence

## Update System

**Status:** Fully implemented with settings persistence

**Location:** `electron-main.js`

**Components:**
- `checkForUpdates(silent)`: Fetches latest release from GitHub API
- `versionNewer(latest, current)`: Semantic version comparison
- Dialog with "Download Update" (opens releases page) and "Later"
- `loadSettings()` / `saveSettings()`: Persistent settings storage

**GitHub Integration:**
- Repository: `jj-repository/TextCompare`
- API: `https://api.github.com/repos/jj-repository/TextCompare/releases/latest`

**Features:**
- Auto-check on startup (configurable via Help menu)
- Settings persisted in `userData/settings.json`
- Silent mode for startup checks (no popup if up-to-date)
- Manual check via Help menu

## Dependencies

```json
{
  "devDependencies": {
    "electron": "^39.2.7",
    "electron-builder": "^26.0.12"
  }
}
```

Minimal dependencies - uses only Electron with no additional runtime dependencies.

## Window State Persistence

**File:** `userData/window-state.json`

**Stored State:**
```javascript
{
  width: 1400,
  height: 900,
  x: undefined,
  y: undefined,
  isMaximized: false
}
```

**Features:**
- Validates window position against display bounds
- Resets off-screen windows to default position
- Only saves bounds if not maximized

## Security Configuration

```javascript
webPreferences: {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false
}
```

**Production Security:**
- DevTools disabled in production builds
- Keyboard shortcuts (F12, Ctrl+Shift+I) blocked

## Menu Structure

- **File**: Load File 1, Load File 2, Compare, Exit
- **Edit**: Standard edit operations
- **View**: Reload, Toggle Fullscreen, Zoom
- **Window**: Minimize, Zoom, Close
- **Help**: Check for Updates, About

## Build Configuration

```json
{
  "build": {
    "appId": "com.textcompare.app",
    "productName": "TextCompare",
    "linux": { "target": ["AppImage", "deb"] },
    "win": { "target": ["nsis", "portable"] }
  }
}
```

## Known Issues / Technical Debt

1. **No direct download**: Update opens releases page instead of downloading directly
2. **Single-file frontend**: 1500+ lines in index.html could be modularized
3. **No IPC**: Frontend doesn't communicate with main process for file operations

## Common Development Tasks

### Adding IPC communication
1. Add handlers in `electron-main.js` with `ipcMain.handle()`
2. Expose in `preload.js` via `contextBridge.exposeInMainWorld()`
3. Call from renderer via `window.electron.methodName()`

### Adding direct download for updates
1. Parse release assets from GitHub API response
2. Download appropriate binary for platform
3. Save to temp directory with progress tracking
4. Show notification when complete

## Platform Notes

### Linux
- Builds AppImage and .deb
- Icon at `icon.png`

### Windows
- Builds NSIS installer and portable
- Same icon file
