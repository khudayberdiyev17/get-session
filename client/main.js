const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');

let mainWindow = null;
let allowQuit  = false;

// ── Production flag ───────────────────────────────────────────────────────────
const IS_PROD = app.isPackaged;

// ── Config ────────────────────────────────────────────────────────────────────
// Packaged holatda config.json resources/ papkasidan o'qiladi (user tahrirlashi mumkin)
// Development holatda loyiha papkasidan o'qiladi
function readConfig() {
  const locations = IS_PROD
    ? [
        path.join(process.resourcesPath, 'config.json'),  // extraResource
        path.join(path.dirname(process.execPath), 'config.json') // .exe yonida
      ]
    : [path.join(__dirname, 'config.json')];

  for (const loc of locations) {
    try {
      const raw = fs.readFileSync(loc, 'utf8');
      return JSON.parse(raw);
    } catch (_) { /* keyingisini sinab ko'ramiz */ }
  }
  return { serverUrl: 'http://localhost:3000/api', wsUrl: 'ws://localhost:3000' };
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    fullscreen:      true,
    frame:           false,
    resizable:       false,
    skipTaskbar:     false,
    backgroundColor: '#070E1B',
    show:            false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      devTools:         !IS_PROD,   // production da DevTools o'chirilgan
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Show only when ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    mainWindow.setVisibleOnAllWorkspaces(true);
  });

  // ── Keyboard blocking (renderer level) ───────────────────────────────────
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const { key, alt, control, meta, shift } = input;

    if (meta)                            return event.preventDefault(); // Win key
    if (alt  && key === 'F4')            return event.preventDefault();
    if (alt  && key === 'Tab')           return event.preventDefault();
    if (alt  && key === 'Escape')        return event.preventDefault();
    if (control && key === 'Escape')     return event.preventDefault();
    if (key  === 'F12')                  return event.preventDefault();
    if (key  === 'F5')                   return event.preventDefault(); // Refresh
    if (key  === 'F11')                  return event.preventDefault(); // Fullscreen toggle

    // Block dangerous Ctrl combos
    if (control) {
      const blocked = ['d','D','w','W','t','T','n','N','r','R','l','L',
                       'p','P','u','U','s','S','h','H','j','J','k','K'];
      if (blocked.includes(key))         return event.preventDefault();
    }

    // Allow Ctrl+Shift+O (emergency) → handled by globalShortcut
    // Allow Ctrl+A/C/V/X/Z for input fields
  });

  // ── Prevent minimize (touchpad 3-finger swipe, Win+D, etc.) ─────────────
  mainWindow.on('minimize', () => {
    if (!allowQuit) {
      mainWindow.restore();
      mainWindow.focus();
    }
  });

  // ── Refocus on blur ───────────────────────────────────────────────────────
  mainWindow.on('blur', () => {
    if (!allowQuit && mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.restore();
          mainWindow.focus();
        }
      }, 120);
    }
  });

  // ── Block close unless allowed ────────────────────────────────────────────
  mainWindow.on('close', (e) => {
    if (!allowQuit) e.preventDefault();
  });
}

// ── App ready ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Emergency exit — MUST register before window creation
  const registered = globalShortcut.register('Control+Shift+O', () => {
    allowQuit = true;
    if (mainWindow) mainWindow.destroy();
    app.quit();
  });
  if (!registered) console.warn('[main] Could not register emergency shortcut');

  createWindow();
});

// ── App events ────────────────────────────────────────────────────────────────
app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('window-all-closed', () => app.quit());

// ── IPC handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('get-config', () => readConfig());

ipcMain.on('force-quit', () => {
  allowQuit = true;
  app.quit();
});
