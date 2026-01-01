const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

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
        return { ...defaultWindowState, ...state };
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
    // Show error dialog to user
    const { dialog } = require('electron');
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
          label: 'About TextCompare',
          click: () => {
            shell.openExternal('https://github.com/jj-repository/TextCompare');
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
