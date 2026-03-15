const { app, BrowserWindow, Menu, shell, dialog, screen, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');

let mainWindow;

// Version and Update Constants
const pkg = require('./package.json');
const APP_VERSION = pkg.version;
const GITHUB_REPO = 'jj-repository/TextCompare';
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

// Settings file for app preferences
const settingsFile = path.join(app.getPath('userData'), 'settings.json');

const defaultSettings = {
  autoCheckUpdates: true
};

function loadSettings() {
  try {
    if (fs.existsSync(settingsFile)) {
      const data = fs.readFileSync(settingsFile, 'utf8');
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return { ...defaultSettings };
}

function saveSettings(settings) {
  try {
    // Ensure the directory exists before writing
    const dir = path.dirname(settingsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

let appSettings = defaultSettings;

// Compare version strings
function versionNewer(latest, current) {
  const parseVersion = (v) => v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const latestParts = parseVersion(latest);
  const currentParts = parseVersion(current);

  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const l = latestParts[i] || 0;
    const c = currentParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

// Detect if running as portable (electron-builder portable extracts to temp dir)
function isPortable() {
  if (process.platform !== 'win32') return false;
  const tempDir = (process.env.TEMP || process.env.TMP || '').toLowerCase();
  return tempDir && process.execPath.toLowerCase().startsWith(tempDir);
}

// Find the right download asset for the current platform
function findDownloadAsset(assets) {
  if (!assets || !Array.isArray(assets)) return null;

  if (process.platform === 'win32') {
    if (isPortable()) {
      // Portable: download portable exe
      return assets.find(a => a.name.endsWith('.exe') && a.name.includes('Portable') && !a.name.includes('blockmap'));
    }
    // Installed: download installer for auto-update
    return assets.find(a => a.name.endsWith('.exe') && a.name.includes('Installer') && !a.name.includes('blockmap'));
  } else if (process.platform === 'linux') {
    return assets.find(a => a.name.endsWith('.AppImage'));
  }
  return null;
}

// Download a file from URL, following redirects
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    // Validate initial URL is HTTPS
    if (!url || !url.startsWith('https://')) {
      reject(new Error('Download URL must be HTTPS'));
      return;
    }

    let redirectCount = 0;
    const MAX_REDIRECTS = 5;
    const DOWNLOAD_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    const doRequest = (requestUrl) => {
      if (redirectCount++ > MAX_REDIRECTS) {
        reject(new Error('Too many redirects'));
        return;
      }
      const req = https.get(requestUrl, {
        headers: { 'User-Agent': `TextCompare/${APP_VERSION}` }
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          res.resume();
          const location = res.headers.location;
          if (!location || !location.startsWith('https://')) {
            reject(new Error('Redirect to non-HTTPS URL blocked'));
            return;
          }
          doRequest(location);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Download failed with status ${res.statusCode}`));
          return;
        }

        const totalBytes = parseInt(res.headers['content-length'], 10) || 0;
        let downloadedBytes = 0;
        const fileStream = fs.createWriteStream(destPath);

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0 && onProgress) {
            onProgress(downloadedBytes, totalBytes);
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve(destPath);
        });

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
      req.setTimeout(DOWNLOAD_TIMEOUT, () => {
        req.destroy();
        fs.unlink(destPath, () => {});
        reject(new Error('Download timed out'));
      });
    };
    doRequest(url);
  });
}

// Handle parsed update response
function handleUpdateResponse(release, silent) {
  const latestVersion = (release.tag_name || '').replace(/^v/, '');

  if (!latestVersion) {
    if (!silent && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Check',
        message: 'Could not determine latest version.',
        buttons: ['OK']
      });
    }
    return;
  }

  if (versionNewer(latestVersion, APP_VERSION)) {
    if (!mainWindow) return;

    const asset = findDownloadAsset(release.assets);

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version is available!\n\nCurrent: v${APP_VERSION}\nLatest: v${latestVersion}`,
      detail: release.body || 'No release notes available.',
      buttons: asset ? ['Download Update', 'Later'] : ['Open Releases Page', 'Later'],
      defaultId: 0
    }).then(async (result) => {
      if (result.response !== 0) return;

      if (!asset) {
        shell.openExternal(GITHUB_RELEASES_URL);
        return;
      }

      // Download directly
      const downloadsDir = app.getPath('downloads');
      const destPath = path.join(downloadsDir, asset.name);

      // Show progress dialog
      if (!mainWindow) return;
      mainWindow.webContents.send('download-progress', { percent: 0, fileName: asset.name });

      try {
        await downloadFile(asset.browser_download_url, destPath, (downloaded, total) => {
          const percent = Math.round((downloaded / total) * 100);
          if (mainWindow) {
            mainWindow.setProgressBar(percent / 100);
            mainWindow.webContents.send('download-progress', { percent, fileName: asset.name });
          }
        });

        if (mainWindow) {
          mainWindow.setProgressBar(-1); // Remove progress bar
          mainWindow.webContents.send('download-progress', null); // Hide overlay
        }

        if (!mainWindow) return;

        // Platform-specific install & restart
        if (process.platform === 'win32' && !isPortable()) {
          // Windows installed: run the downloaded installer, then quit
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Ready',
            message: 'Update downloaded successfully!',
            detail: 'The installer will now open. Follow the prompts to update.',
            buttons: ['Install & Restart', 'Later'],
            defaultId: 0
          }).then((res) => {
            if (res.response === 0) {
              shell.openPath(destPath);
              setTimeout(() => app.quit(), 1000);
            }
          });
        } else if (process.platform === 'linux' && process.env.APPIMAGE) {
          // Linux AppImage: replace the running AppImage and restart
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Ready',
            message: 'Update downloaded successfully!',
            detail: 'The app will restart with the new version.',
            buttons: ['Restart Now', 'Later'],
            defaultId: 0
          }).then((res) => {
            if (res.response === 0) {
              try {
                const appImagePath = process.env.APPIMAGE;
                fs.copyFileSync(destPath, appImagePath);
                fs.chmodSync(appImagePath, 0o755);
                fs.unlink(destPath, () => {}); // Clean up temp download (async, best-effort)
                spawn(appImagePath, [], { detached: true, stdio: 'ignore' }).unref();
                app.quit();
              } catch (replaceErr) {
                // destPath may still exist if copyFileSync failed
                const detail = fs.existsSync(destPath)
                  ? `${replaceErr.message}\n\nThe update was saved to:\n${destPath}`
                  : replaceErr.message;
                dialog.showMessageBox(mainWindow, {
                  type: 'error',
                  title: 'Update Failed',
                  message: 'Could not replace the current version.',
                  detail,
                  buttons: fs.existsSync(destPath) ? ['Open Downloads Folder', 'OK'] : ['OK']
                }).then((r) => {
                  if (r.response === 0 && fs.existsSync(destPath)) shell.showItemInFolder(destPath);
                });
              }
            }
          });
        } else {
          // Fallback (Windows portable, .deb installs, etc.): show download location
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Download Complete',
            message: 'Update downloaded successfully!',
            detail: `Saved to:\n${destPath}`,
            buttons: ['Open in Folder', 'OK'],
            defaultId: 0
          }).then((res) => {
            if (res.response === 0) {
              shell.showItemInFolder(destPath);
            }
          });
        }
      } catch (err) {
        if (mainWindow) {
          mainWindow.setProgressBar(-1);
          mainWindow.webContents.send('download-progress', null);
          dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'Download Failed',
            message: 'Failed to download the update.',
            detail: `${err.message}\n\nYou can download it manually from the releases page.`,
            buttons: ['Open Releases Page', 'OK']
          }).then((res) => {
            if (res.response === 0) {
              shell.openExternal(GITHUB_RELEASES_URL);
            }
          });
        }
      }
    });
  } else if (!silent && mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'No Updates',
      message: `You are running the latest version (v${APP_VERSION}).`,
      buttons: ['OK']
    });
  }
}

// Show update error dialog (only in non-silent mode)
function showUpdateError(silent, detail) {
  if (!silent && mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Update Check Failed',
      message: 'Failed to check for updates.',
      detail,
      buttons: ['OK']
    });
  }
}

// Read a JSON response with size limit, then call handler
function readJsonResponse(res, silent, handler) {
  const MAX_SIZE = 1024 * 1024; // 1MB limit
  let data = '';
  let totalSize = 0;
  let destroyed = false;

  res.on('data', chunk => {
    if (destroyed) return;
    totalSize += chunk.length;
    if (totalSize > MAX_SIZE) {
      destroyed = true;
      res.destroy();
      showUpdateError(silent, 'Response exceeded 1MB size limit.');
      return;
    }
    data += chunk;
  });

  res.on('end', () => {
    if (destroyed) return;
    try {
      handler(JSON.parse(data));
    } catch (e) {
      showUpdateError(silent, e.message);
    }
  });
}

// Check for updates
function checkForUpdates(silent = false) {
  const requestHeaders = { 'User-Agent': `TextCompare/${APP_VERSION}` };

  const handleResponse = (res) => {
    // Handle redirects (301/302)
    if (res.statusCode === 301 || res.statusCode === 302) {
      const redirectUrl = res.headers.location;
      res.resume();
      if (!redirectUrl || !redirectUrl.startsWith('https://')) {
        showUpdateError(silent, 'Redirect to non-HTTPS URL blocked.');
        return;
      }
      https.get(redirectUrl, { headers: requestHeaders }, (redirectRes) => {
        if (redirectRes.statusCode !== 200) {
          redirectRes.resume();
          showUpdateError(silent, `Redirect returned status ${redirectRes.statusCode}.`);
          return;
        }
        readJsonResponse(redirectRes, silent, (release) => handleUpdateResponse(release, silent));
      }).on('error', (e) => showUpdateError(silent, e.message));
      return;
    }

    if (res.statusCode !== 200) {
      res.resume();
      showUpdateError(silent, `Server returned status ${res.statusCode}.`);
      return;
    }

    readJsonResponse(res, silent, (release) => handleUpdateResponse(release, silent));
  };

  const req = https.request({
    hostname: 'api.github.com',
    path: `/repos/${GITHUB_REPO}/releases/latest`,
    method: 'GET',
    headers: requestHeaders
  }, handleResponse);

  req.on('error', (e) => showUpdateError(silent, e.message));

  req.setTimeout(10000, () => {
    req.destroy();
    showUpdateError(silent, 'Request timed out after 10 seconds.');
  });

  req.end();
}

// Window state persistence
const stateFile = path.join(app.getPath('userData'), 'window-state.json');

const defaultWindowState = {
  width: 1400,
  height: 900,
  x: undefined,
  y: undefined,
  isMaximized: false
};

function loadWindowState() {
  try {
    if (fs.existsSync(stateFile)) {
      const data = fs.readFileSync(stateFile, 'utf8');
      const state = JSON.parse(data);
      // Validate state has required properties
      if (state && typeof state.width === 'number' && typeof state.height === 'number') {
        const mergedState = { ...defaultWindowState, ...state };

        // Validate window position is within visible screen bounds
        if (typeof mergedState.x === 'number' && typeof mergedState.y === 'number') {
          const displays = screen.getAllDisplays();
          const isVisible = displays.some(display => {
            const { x, y, width, height } = display.bounds;
            return mergedState.x >= x && mergedState.x < x + width &&
                   mergedState.y >= y && mergedState.y < y + height;
          });

          // Reset position if window would be off-screen
          if (!isVisible) {
            mergedState.x = undefined;
            mergedState.y = undefined;
          }
        }

        return mergedState;
      }
    }
  } catch (err) {
    console.error('Failed to load window state:', err);
  }
  return defaultWindowState;
}

function saveWindowState() {
  if (!mainWindow) return;

  try {
    const state = {
      isMaximized: mainWindow.isMaximized()
    };

    // Only save bounds if not maximized
    if (!state.isMaximized) {
      const bounds = mainWindow.getBounds();
      state.width = bounds.width;
      state.height = bounds.height;
      state.x = bounds.x;
      state.y = bounds.y;
    }

    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('Failed to save window state:', err);
  }
}

function createWindow() {
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'TextCompare - Text Diff Tool'
  });

  // Restore maximized state
  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.loadFile('index.html').catch(err => {
    console.error('Failed to load index.html:', err);
    dialog.showErrorBox('Load Error', 'Failed to load the application. Please reinstall.');
    app.quit();
  });

  // Block DevTools in production builds (packaged apps)
  if (app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      // Block F12, Ctrl+Shift+I, Cmd+Option+I
      if (input.key === 'F12' ||
          (input.control && input.shift && input.key.toLowerCase() === 'i') ||
          (input.meta && input.alt && input.key.toLowerCase() === 'i')) {
        event.preventDefault();
      }
    });
  }

  // Save state on window events (debounced to avoid excessive disk writes)
  let saveTimeout;
  const debouncedSave = () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveWindowState, 500);
  };
  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);
  mainWindow.on('close', saveWindowState);

  // Create application menu
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        // Only show DevTools in development mode (not in packaged/production builds)
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }]),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => {
            checkForUpdates(false);
          }
        },
        {
          label: 'Check for Updates on Startup',
          type: 'checkbox',
          checked: appSettings.autoCheckUpdates,
          click: (menuItem) => {
            appSettings.autoCheckUpdates = menuItem.checked;
            saveSettings(appSettings);
          }
        },
        { type: 'separator' },
        {
          label: 'View on GitHub',
          click: () => {
            shell.openExternal('https://github.com/jj-repository/TextCompare');
          }
        },
        {
          label: 'About TextCompare',
          click: () => {
            const win = mainWindow || BrowserWindow.getFocusedWindow();
            if (!win) return;
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'About TextCompare',
              message: `TextCompare v${APP_VERSION}`,
              detail: 'A modern text diff tool with side-by-side comparison.\n\nBuilt with Electron.',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ]);

  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers (registered once, outside createWindow)
ipcMain.handle('check-for-updates', () => {
  checkForUpdates(false);
});
ipcMain.handle('get-settings', () => {
  return { ...appSettings, version: APP_VERSION };
});
ipcMain.handle('set-auto-update', (_, enabled) => {
  appSettings.autoCheckUpdates = enabled === true;
  saveSettings(appSettings);
});
ipcMain.handle('open-external', (_, url) => {
  // Only allow https URLs to prevent file:// or custom protocol abuse
  if (typeof url === 'string' && url.startsWith('https://')) {
    shell.openExternal(url);
  }
});

app.whenReady().then(() => {
  // Load settings before creating window
  appSettings = loadSettings();

  createWindow();

  // Check for updates on startup if enabled (with delay)
  if (appSettings.autoCheckUpdates) {
    setTimeout(() => {
      checkForUpdates(true);
    }, 4000);  // 4 second delay to let UI initialize
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
