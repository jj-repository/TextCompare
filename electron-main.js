const { app, BrowserWindow, Menu, shell, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

let mainWindow;

// Version and Update Constants
const pkg = require('./package.json');
const APP_VERSION = pkg.version;
const GITHUB_REPO = 'jj-repository/TextCompare';
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;
const GITHUB_API_LATEST = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

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

// Check for updates
function checkForUpdates(silent = false) {
  const options = {
    hostname: 'api.github.com',
    path: `/repos/${GITHUB_REPO}/releases/latest`,
    method: 'GET',
    headers: {
      'User-Agent': `TextCompare/${APP_VERSION}`
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const release = JSON.parse(data);
        const latestVersion = (release.tag_name || '').replace(/^v/, '');

        if (!latestVersion) {
          if (!silent) {
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
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Available',
            message: `A new version is available!\n\nCurrent: v${APP_VERSION}\nLatest: v${latestVersion}`,
            detail: release.body || 'No release notes available.',
            buttons: ['Download Update', 'Later'],
            defaultId: 0
          }).then(result => {
            if (result.response === 0) {
              shell.openExternal(GITHUB_RELEASES_URL);
            }
          });
        } else if (!silent) {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'No Updates',
            message: `You are running the latest version (v${APP_VERSION}).`,
            buttons: ['OK']
          });
        }
      } catch (e) {
        if (!silent) {
          dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'Update Check Failed',
            message: 'Failed to check for updates.',
            detail: e.message,
            buttons: ['OK']
          });
        }
      }
    });
  });

  req.on('error', (e) => {
    if (!silent) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Update Check Failed',
        message: 'Failed to check for updates.',
        detail: e.message,
        buttons: ['OK']
      });
    }
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
      sandbox: true
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

  // Save state on window events
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
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
        { role: 'toggleDevTools' },
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
            dialog.showMessageBox(mainWindow, {
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

app.whenReady().then(createWindow);

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
