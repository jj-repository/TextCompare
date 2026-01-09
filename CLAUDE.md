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

**Status:** Partial implementation (check only, no download)

**Location:** `electron-main.js` (lines 8-109)

**Components:**
- `checkForUpdates(silent)`: Fetches latest release from GitHub API
- `versionNewer(latest, current)`: Semantic version comparison
- Dialog with "Download Update" (opens releases page) and "Later"

**GitHub Integration:**
- Repository: `jj-repository/TextCompare`
- API: `https://api.github.com/repos/jj-repository/TextCompare/releases/latest`

**Current Flow:**
1. Manual check via Help menu → "Check for Updates..."
2. Fetches latest release info
3. Shows dialog with version info and release notes
4. "Download Update" opens GitHub releases in browser

**Missing:**
- No auto-check on startup
- No settings for auto_check_updates
- No actual download functionality
- No settings persistence

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

1. **No auto-update**: Only manual check, no download capability
2. **No settings persistence**: No preferences file for user settings
3. **Single-file frontend**: 1500+ lines in index.html could be modularized
4. **No IPC**: Frontend doesn't communicate with main process

## Common Development Tasks

### Adding settings persistence
1. Create settings file in `app.getPath('userData')`
2. Load on app startup
3. Add IPC handlers for save/load from renderer

```javascript
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return { autoCheckUpdates: true };
  }
}
```

### Adding auto-update check on startup
1. Add setting for `autoCheckUpdates`
2. Call `checkForUpdates(true)` after window ready
3. Add delay to avoid blocking startup

```javascript
mainWindow.once('ready-to-show', () => {
  if (settings.autoCheckUpdates) {
    setTimeout(() => checkForUpdates(true), 4000);
  }
});
```

### Adding download functionality
1. Use `https` module to download release asset
2. Save to temp directory
3. Show notification when complete
4. Open containing folder

## Platform Notes

### Linux
- Builds AppImage and .deb
- Icon at `icon.png`

### Windows
- Builds NSIS installer and portable
- Same icon file
