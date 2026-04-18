const { app, BrowserWindow, Menu, shell, dialog, screen, ipcMain, session } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');

let mainWindow;

// Version and Update Constants
const pkg = require('./package.json');
const APP_VERSION = pkg.version;
// Display version uses X.YY format (tag: v2.04, semver: 2.4.0)
const DISPLAY_VERSION = APP_VERSION.replace(/^(\d+)\.(\d+)\.\d+$/, (_, maj, min) => `${maj}.${min.padStart(2, '0')}`);
const GITHUB_REPO = 'jj-repository/TextCompare';
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

// Settings file for app preferences
const settingsFile = path.join(app.getPath('userData'), 'settings.json');

const defaultSettings = {
  autoCheckUpdates: false
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
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

let appSettings = defaultSettings;
let isUpdateInProgress = false;

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

// Find the right download asset for the current platform
function findDownloadAsset(assets) {
  if (!assets || !Array.isArray(assets)) return null;

  if (process.platform === 'win32') {
    return assets.find(a => a.name.endsWith('.exe') && !a.name.includes('blockmap'));
  } else if (process.platform === 'linux') {
    return assets.find(a => a.name.endsWith('.AppImage'));
  }
  return null;
}

// Fetch expected SHA-256 hash for an asset from checksums-sha256.txt
async function fetchExpectedSha256(releaseData, assetName) {
  const checksumAsset = releaseData.assets.find(a => a.name === 'checksums-sha256.txt');
  if (!checksumAsset) return null;

  try {
    const response = await new Promise((resolve, reject) => {
      const url = new URL(checksumAsset.browser_download_url);
      const makeRequest = (reqUrl, redirectCount = 0) => {
        if (redirectCount > 5) { reject(new Error('Too many redirects')); return; }
        if (reqUrl.protocol !== 'https:') { reject(new Error('HTTPS required')); return; }
        https.get(reqUrl, { headers: { 'User-Agent': `TextCompare/${APP_VERSION}` } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            makeRequest(new URL(res.headers.location), redirectCount + 1);
          } else {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
          }
        }).on('error', reject);
      };
      makeRequest(url);
    });

    for (const line of response.trim().split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[1] === assetName) {
        return parts[0].toLowerCase();
      }
    }
  } catch (e) {
    console.warn('Could not fetch checksums:', e.message);
  }
  return null;
}

// Compute SHA-256 hash of a local file
function computeFileSha256(filePath) {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex').toLowerCase();
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
    isUpdateInProgress = false;
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
    if (!mainWindow) {
      isUpdateInProgress = false;
      return;
    }

    const asset = findDownloadAsset(release.assets);

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version is available!\n\nCurrent: v${DISPLAY_VERSION}\nLatest: ${release.tag_name}`,
      detail: release.body || 'No release notes available.',
      buttons: asset ? ['Download Update', 'Later'] : ['Open Releases Page', 'Later'],
      defaultId: 0
    }).then(async (result) => {
      if (result.response !== 0) {
        isUpdateInProgress = false;
        return;
      }

      if (!asset) {
        isUpdateInProgress = false;
        shell.openExternal(GITHUB_RELEASES_URL);
        return;
      }

      // Download next to the running executable.
      // Windows portable (electron-builder target: portable) extracts to %TEMP%\<random>\
      // at runtime, so process.execPath points there — not the folder the user placed
      // TextCompare.exe in. PORTABLE_EXECUTABLE_FILE / _DIR expose the real location.
      const exePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
      const exeDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(exePath);
      const safeName = path.basename(asset.name).replace(/[<>:"|?*\x00-\x1f]/g, '_');
      if (!safeName || safeName === '.' || safeName === '..') {
        isUpdateInProgress = false;
        shell.openExternal(GITHUB_RELEASES_URL);
        return;
      }

      // Show progress dialog
      if (!mainWindow) {
        isUpdateInProgress = false;
        return;
      }
      mainWindow.webContents.send('download-progress', { percent: 0, fileName: asset.name });

      try {
        // Platform-specific download and replace
        if (process.platform === 'linux' && process.env.APPIMAGE) {
          // Linux AppImage: download temp file next to AppImage, then replace
          const appImagePath = process.env.APPIMAGE;
          const tempPath = appImagePath + '.new';

          await downloadFile(asset.browser_download_url, tempPath, (downloaded, total) => {
            const percent = Math.round((downloaded / total) * 100);
            if (mainWindow) {
              mainWindow.setProgressBar(percent / 100);
              mainWindow.webContents.send('download-progress', { percent, fileName: asset.name });
            }
          });

          if (mainWindow) {
            mainWindow.setProgressBar(-1);
            mainWindow.webContents.send('download-progress', null);
          }

          if (!mainWindow) {
            isUpdateInProgress = false;
            return;
          }

          // Verify SHA-256 before applying
          const expectedHashLinux = await fetchExpectedSha256(release, asset.name);
          if (expectedHashLinux) {
            const actualHashLinux = computeFileSha256(tempPath);
            if (actualHashLinux !== expectedHashLinux) {
              fs.unlinkSync(tempPath);
              throw new Error(`SHA-256 mismatch for ${asset.name}! Expected: ${expectedHashLinux.substring(0,16)}... Got: ${actualHashLinux.substring(0,16)}...`);
            }
            console.log(`SHA-256 verified for ${asset.name}`);
          }

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
                fs.copyFileSync(tempPath, appImagePath);
                fs.chmodSync(appImagePath, 0o755);
                fs.unlink(tempPath, () => {});
                spawn(appImagePath, [], { detached: true, stdio: 'ignore' }).unref();
                isUpdateInProgress = false;
                app.quit();
              } catch (replaceErr) {
                isUpdateInProgress = false;
                const detail = fs.existsSync(tempPath)
                  ? `${replaceErr.message}\n\nThe update was saved to:\n${tempPath}`
                  : replaceErr.message;
                dialog.showMessageBox(mainWindow, {
                  type: 'error',
                  title: 'Update Failed',
                  message: 'Could not replace the current version.',
                  detail,
                  buttons: ['OK']
                });
              }
            } else {
              fs.unlink(tempPath, () => {});
              isUpdateInProgress = false;
            }
          });
        } else {
          // Windows portable: rename-dance (current→.old, .new→current)
          const newExePath = exePath + '.new';
          const oldExePath = exePath.replace(/\.exe$/i, '.old');

          await downloadFile(asset.browser_download_url, newExePath, (downloaded, total) => {
            const percent = Math.round((downloaded / total) * 100);
            if (mainWindow) {
              mainWindow.setProgressBar(percent / 100);
              mainWindow.webContents.send('download-progress', { percent, fileName: asset.name });
            }
          });

          if (mainWindow) {
            mainWindow.setProgressBar(-1);
            mainWindow.webContents.send('download-progress', null);
          }

          if (!mainWindow) {
            isUpdateInProgress = false;
            return;
          }

          // Verify SHA-256 before applying
          const expectedHashWin = await fetchExpectedSha256(release, asset.name);
          if (expectedHashWin) {
            const actualHashWin = computeFileSha256(newExePath);
            if (actualHashWin !== expectedHashWin) {
              fs.unlinkSync(newExePath);
              throw new Error(`SHA-256 mismatch for ${asset.name}! Expected: ${expectedHashWin.substring(0,16)}... Got: ${actualHashWin.substring(0,16)}...`);
            }
            console.log(`SHA-256 verified for ${asset.name}`);
          }

          try {
            // Remove leftover .old from previous update
            if (fs.existsSync(oldExePath)) fs.unlinkSync(oldExePath);
            // Rename running exe → .old
            fs.renameSync(exePath, oldExePath);
            // Rename .new → original name
            fs.renameSync(newExePath, exePath);

            isUpdateInProgress = false;
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Update Complete',
              message: 'Update installed successfully!',
              detail: 'Please reopen the app to use the new version.',
              buttons: ['Close']
            }).then(() => {
              app.quit();
            });
          } catch (renameErr) {
            // Fallback: .bat trampoline runs after process exits
            // Validate paths don't contain quotes (breaks bat quoting)
            if (newExePath.includes('"') || exePath.includes('"')) {
              isUpdateInProgress = false;
              dialog.showMessageBox(mainWindow, {
                type: 'error', title: 'Update Failed',
                message: 'Install path contains invalid characters. Please reinstall to a simple path.',
                buttons: ['OK']
              });
              return;
            }
            const batPath = path.join(exeDir, `_update_${Date.now()}.bat`);
            fs.writeFileSync(batPath,
              `:wait\r\ntasklist /FI "PID eq ${process.pid}" 2>nul | find "${process.pid}" >nul && ` +
              `(timeout /t 1 /nobreak >nul & goto wait)\r\n` +
              `move /y "${newExePath}" "${exePath}"\r\n` +
              `del "%~f0"\r\n`
            );
            spawn('cmd', ['/c', batPath], {
              detached: true,
              stdio: 'ignore',
              windowsHide: true
            }).unref();

            isUpdateInProgress = false;
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Update Ready',
              message: 'Update will be applied when you close the app.',
              detail: 'Please close and reopen the app.',
              buttons: ['Close Now']
            }).then(() => {
              app.quit();
            });
          }
        }
      } catch (err) {
        isUpdateInProgress = false;
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
    }).catch(() => {
      isUpdateInProgress = false;
    });
  } else {
    isUpdateInProgress = false;
    if (!silent && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'No Updates',
        message: `You are running the latest version (v${DISPLAY_VERSION}).`,
        buttons: ['OK']
      });
    }
  }
}

// Show update error dialog (only in non-silent mode)
function showUpdateError(silent, detail) {
  isUpdateInProgress = false;
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
  if (isUpdateInProgress) {
    if (!silent && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info', title: 'Update', message: 'An update check is already in progress.', buttons: ['OK']
      });
    }
    return;
  }
  isUpdateInProgress = true;

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

  req.on('error', (e) => {
    isUpdateInProgress = false;
    showUpdateError(silent, e.message);
  });

  req.setTimeout(10000, () => {
    req.destroy();
    isUpdateInProgress = false;
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
    // Always save normal bounds so unmaximize restores correctly
    const bounds = mainWindow.getNormalBounds();
    const state = {
      isMaximized: mainWindow.isMaximized(),
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y
    };

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
      webSecurity: true,
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
    // Close DevTools if opened by any other means (programmatic, menu injection, etc.)
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
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
              message: `TextCompare v${DISPLAY_VERSION}`,
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
ipcMain.on('check-for-updates', () => {
  checkForUpdates(false);
});
ipcMain.handle('get-settings', () => {
  return { ...appSettings, version: DISPLAY_VERSION };
});
ipcMain.on('set-auto-update', (_, enabled) => {
  appSettings.autoCheckUpdates = enabled === true;
  saveSettings(appSettings);
});
// Allowlisted domains for shell.openExternal to prevent opening arbitrary URLs
const OPEN_EXTERNAL_ALLOWED_HOSTS = ['github.com', 'jj-repository.github.io'];
function isAllowedExternalUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('https://')) return false;
  try {
    const { hostname } = new URL(url);
    return OPEN_EXTERNAL_ALLOWED_HOSTS.some(
      h => hostname === h || hostname.endsWith('.' + h)
    );
  } catch (_) {
    return false;
  }
}
ipcMain.on('open-external', (_, url) => {
  if (isAllowedExternalUrl(url)) {
    shell.openExternal(url);
  }
});
ipcMain.handle('save-file', async (_, { filePath, defaultName, content }) => {
  let targetPath = filePath;
  if (!targetPath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName || 'file.txt',
      filters: [
        { name: 'Text Files', extensions: ['txt', 'md', 'csv', 'log', 'json', 'xml', 'html', 'js', 'ts', 'css'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    targetPath = result.filePath;
  }
  try {
    fs.writeFileSync(targetPath, content, 'utf8');
    return { success: true, filePath: targetPath };
  } catch (err) {
    return { success: false, canceled: false, error: err.message };
  }
});

// Prevent unhandled rejections from crashing the process
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

// Block remote debugging in production
if (app.isPackaged) {
  app.commandLine.appendSwitch('inspect', '0');
  app.commandLine.appendSwitch('remote-debugging-port', '0');
}

// Restrict navigation and new windows on all webContents
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

app.whenReady().then(() => {
  // Deny all permission requests (camera, mic, geolocation, etc.)
  session.defaultSession.setPermissionRequestHandler((_, __, callback) => {
    callback(false);
  });

  // Load settings before creating window
  appSettings = loadSettings();

  createWindow();

  // Clean up leftover update artifacts off the startup critical path
  setImmediate(() => {
    try {
      const realExePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
      const exeDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(realExePath);
      const exeName = path.basename(realExePath);
      for (const file of fs.readdirSync(exeDir)) {
        if ((file === exeName + '.old') || (file === exeName + '.new') || /^_update_\d+\.bat$/.test(file)) {
          try { fs.unlinkSync(path.join(exeDir, file)); } catch (_) {}
        }
      }
    } catch (_) {}
  });

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
