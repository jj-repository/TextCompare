# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TextCompare** is an Electron desktop application for comparing text with side-by-side diff visualization. It features an optimized LCS (Longest Common Subsequence) algorithm, minimap navigation, and a VS Code-inspired dark theme.

**Version:** 2.3.2

## Files Structure

```
TextCompare/
├── electron-main.js       # Electron main process (window, menu, updates, download)
├── preload.js             # Context bridge for IPC (updates, settings, downloads)
├── index.html             # Single-file frontend (HTML + CSS + JS)
├── package.json           # Dependencies and build config
├── icon.png               # Application icon
├── takodachi.webp         # Mascot image used in settings modal
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

### Simple Three-File Design

- **electron-main.js**: Electron main process with window management, menus, update checking, and direct update downloads
- **preload.js**: Context bridge exposing IPC for update checking, settings, download progress, and external links
- **index.html**: Complete frontend in a single file (HTML/CSS/JS)

### Key Features

- Positional side-by-side text comparison (only changed characters highlighted)
- Line-by-line diff highlighting
- Click-to-edit on diff view (double-click to return to editing)
- Minimap for navigation
- Ignore whitespace / ignore case options
- File drag-and-drop
- Undo button for mouse-only users
- Clear All confirmation popup
- Window state persistence
- Settings modal (auto-update toggle, readme link, version info)

## Update System

**Status:** Fully implemented with direct download and progress tracking

**Location:** `electron-main.js`

**Components:**
- `checkForUpdates(silent)`: Fetches latest release from GitHub API
- `versionNewer(latest, current)`: Semantic version comparison
- `findDownloadAsset(assets)`: Finds platform-specific binary (portable .exe for Windows, .AppImage for Linux)
- `downloadFile(url, destPath, onProgress)`: HTTPS download with redirect following, progress callback
- `handleUpdateResponse(release, silent)`: Dialog with "Download Update" button for direct download, or "Open Releases Page" fallback
- `loadSettings()` / `saveSettings()`: Persistent settings storage

**GitHub Integration:**
- Repository: `jj-repository/TextCompare`
- API: `https://api.github.com/repos/jj-repository/TextCompare/releases/latest`

**Features:**
- Auto-check on startup (configurable via Help menu or settings modal)
- Direct download with progress bar (taskbar + in-app overlay via IPC)
- HTTPS validation on all redirects (blocks non-HTTPS redirects)
- 1MB response size limit on API calls
- Settings persisted in `userData/settings.json`
- Silent mode for startup checks (no popup if up-to-date)
- Manual check via Help menu or toolbar Updates button
- 10-second request timeout
- Fallback to opening releases page if asset not found

## IPC Handlers

Registered in `electron-main.js`, exposed via `preload.js`:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `check-for-updates` | renderer → main | Trigger manual update check |
| `get-settings` | renderer → main | Get app settings + version |
| `set-auto-update` | renderer → main | Toggle auto-update preference |
| `open-external` | renderer → main | Open HTTPS URL in browser (whitelist validated) |
| `download-progress` | main → renderer | Send download progress (percent, fileName) |

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

**Features:**
- Validates window position against display bounds
- Resets off-screen windows to default position
- Only saves bounds if not maximized
- Debounced saves (500ms) to avoid excessive disk writes

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
- Keyboard shortcuts (F12, Ctrl+Shift+I) blocked in packaged builds
- HTTPS validation on all redirects (update checker & downloader)
- URL whitelist on `open-external` IPC (only `https://` allowed)
- 1MB response size limit on update API calls
- ipcRenderer listener cleanup prevents memory leaks
- No external network calls except update check and download

## Menu Structure

- **File**: Quit
- **Edit**: Undo, Redo, Cut, Copy, Paste, Select All
- **View**: Reload, Force Reload, DevTools (dev only), Zoom, Fullscreen
- **Window**: Minimize, Close
- **Help**: Check for Updates, Auto-Update Toggle, View on GitHub, About

**Toolbar:** Includes an "Updates" button for in-app update checking via IPC, plus a settings gear icon.

## Build Configuration

```json
{
  "build": {
    "appId": "com.textcompare.app",
    "productName": "TextCompare",
    "linux": {
      "target": ["AppImage", "deb"],
      "artifactName": "TextCompare${version}Linux.${ext}"
    },
    "win": {
      "target": ["nsis", "portable"]
    },
    "nsis": {
      "artifactName": "TextCompareInstaller${version}.${ext}"
    },
    "portable": {
      "artifactName": "TextCompare${version}Portable.${ext}"
    }
  }
}
```

## Platform Notes

### Linux
- Builds AppImage and .deb
- Icon at `icon.png`

### Windows
- Builds NSIS installer and portable
- Same icon file

---

## Review Status

> **Last Full Review:** 2026-03-15
> **Status:** Production Ready

### Security Review
- [x] Context isolation enabled
- [x] Sandbox mode enabled
- [x] No nodeIntegration
- [x] DevTools disabled in production
- [x] Keyboard shortcuts blocked (F12, Ctrl+Shift+I)
- [x] HTTPS validation on redirects (update checker + downloader)
- [x] URL whitelist on open-external IPC
- [x] 1MB response size limit on API responses
- [x] ipcRenderer listener cleanup (no memory leaks)
- [x] Update check has timeout (10s)

### Code Quality
- [x] All tests passing (26 tests)
- [x] No unused variables
- [x] Drag-and-drop implemented
- [x] Window state persistence working
- [x] Debounced window state saves

## Intentional Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single index.html file | Simple distribution; no build step for frontend |
| Direct update download | Downloads portable exe/AppImage directly with progress bar |
| Minimal dependencies | Only Electron; no runtime dependencies |
| VS Code-like theme | Familiar to developers; good contrast for diffs |
| Positional diff (v2.3.0) | Text stays in place; only changed chars highlighted in red |

## Completed Optimizations

- Drag-and-drop file loading
- Visual feedback for drag operations
- Unused variable cleanup
- Window state persistence
- LCS algorithm optimized (push+reverse instead of O(n^2) unshift)
- Direct update downloads with progress + 5-min timeout
- HTTPS redirect validation
- ipcRenderer listener memory leak fix
- Debounced window state saves
- Settings modal with auto-update toggle
- Click-to-edit on diff view
- Undo button and Clear All confirmation
- Download filename sanitization (path traversal prevention)
- Concurrent update check guard
- Unhandled rejection handler
