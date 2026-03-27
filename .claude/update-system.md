# Update System

Fully implemented with direct download and progress tracking.

## Functions (`electron-main.js`)
- `checkForUpdates(silent)` — GitHub API fetch
- `versionNewer(latest, current)` — semantic compare
- `findDownloadAsset(assets)` — platform binary (.exe portable / .AppImage)
- `downloadFile(url, destPath, onProgress)` — HTTPS with redirect following + progress
- `handleUpdateResponse(release, silent)` — dialog: Download Update / Open Releases fallback
- `loadSettings()` / `saveSettings()` — `userData/settings.json`

## GitHub
Repo: `jj-repository/TextCompare`
API: `https://api.github.com/repos/jj-repository/TextCompare/releases/latest`

## Features
- Auto-check on startup (configurable), silent if up-to-date
- Direct download with progress (taskbar + in-app overlay via IPC)
- HTTPS validation on all redirects, 1MB API response limit, 10s request timeout, 5-min download timeout
- Concurrent update check guard, fallback to releases page if asset not found
