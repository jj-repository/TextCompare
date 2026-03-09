# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TextCompare** is an Electron desktop application for comparing text with side-by-side diff visualization. It features an optimized LCS (Longest Common Subsequence) algorithm, minimap navigation, and a VS Code-inspired dark theme.

**Version:** 2.2.6

## Files Structure

```
TextCompare/
├── electron-main.js       # Electron main process (window, menu, updates)
├── preload.js             # Context bridge for IPC (update checking)
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
- **preload.js**: Context bridge exposing IPC for update checking to the renderer
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
- 10-second request timeout

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
- **Toolbar**: Includes an "Updates" button for in-app update checking via IPC

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
3. **Limited IPC**: IPC used for update checking; file operations still handled directly in renderer

## Recent Fixes (January 2026)

- Removed unused `div` variable in escapeHtml() function (diff-utils.js)
- Implemented drag-and-drop file support with visual feedback (was documented but not implemented)
- Added .drag-over CSS styling for drag-drop visual feedback
- Fixed null reference error when window closes during update check (added mainWindow checks)

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

---

## Review Status

> **Last Full Review:** 2026-01-10
> **Status:** ✅ Production Ready

### Security Review ✅
- [x] Context isolation enabled
- [x] Sandbox mode enabled
- [x] No nodeIntegration
- [x] DevTools disabled in production
- [x] Keyboard shortcuts blocked (F12, Ctrl+Shift+I)
- [x] No external network calls except update check
- [x] Update check has timeout (10s)

### Code Quality ✅
- [x] All tests passing (26 tests)
- [x] No unused variables
- [x] Drag-and-drop implemented
- [x] Window state persistence working

## Quality Standards

**Target:** Text diff tool - fast, accurate, simple to use

| Aspect | Standard | Status |
|--------|----------|--------|
| Security | Electron best practices followed | ✅ Met |
| Accuracy | Diff algorithm correct | ✅ Met |
| Performance | Handles large files | ✅ Met |
| UX | Intuitive side-by-side view | ✅ Met |
| Documentation | CLAUDE.md current | ✅ Met |

## Intentional Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single index.html file | Simple distribution; no build step for frontend |
| IPC only for updates | Files loaded directly in renderer; IPC used for update checking |
| Update opens releases page | Avoids binary download/verification complexity |
| Minimal dependencies | Only Electron; no runtime dependencies |
| VS Code-like theme | Familiar to developers; good contrast for diffs |

## Won't Fix (Accepted Limitations)

| Issue | Reason |
|-------|--------|
| No direct update download | Opens releases page; keeps app simple |
| Single-file frontend (1500+ lines) | Works fine; splitting would add build complexity |
| No IPC for file operations | File operations work fine in renderer for this use case |
| No syntax highlighting | Scope creep; this is a diff tool, not an editor |

## Completed Optimizations

- ✅ Drag-and-drop file loading
- ✅ Visual feedback for drag operations
- ✅ Unused variable cleanup
- ✅ Window state persistence
- ✅ LCS algorithm optimized

**DO NOT further optimize:** The diff algorithm is already optimized. For very large files (10MB+), performance is acceptable. Further optimization would require fundamentally different approach (streaming, workers).
