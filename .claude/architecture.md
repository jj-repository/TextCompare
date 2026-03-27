# Architecture

## Three-File Design
- `electron-main.js` — window management, menus, update check, direct download
- `preload.js` — context bridge IPC exposure
- `index.html` — complete frontend (no build step)
Minimal deps: only Electron, no runtime dependencies.

## IPC Handlers
| Channel | Direction | Purpose |
|---------|-----------|---------|
| `check-for-updates` | renderer→main | Manual update check |
| `get-settings` | renderer→main | Settings + version |
| `set-auto-update` | renderer→main | Toggle auto-update |
| `open-external` | renderer→main | Open HTTPS URL (whitelist validated) |
| `download-progress` | main→renderer | Progress (percent, fileName) |

## Menu
- Edit: Undo, Redo, Cut, Copy, Paste, Select All
- View: Reload, Force Reload, DevTools (dev only), Zoom, Fullscreen
- Help: Check for Updates, Auto-Update Toggle, GitHub, About
- Toolbar: Updates button (IPC), settings gear

## Window State (`userData/window-state.json`)
Validates position against display bounds, resets off-screen, saves only if not maximized, debounced 500ms.
