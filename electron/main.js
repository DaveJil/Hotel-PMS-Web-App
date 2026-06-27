const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initDatabase } = require('./database');
const { registerIpcHandlers } = require('./ipc');
const { startBackgroundSync } = require('./sync');
const { startEmailWorker } = require('./email');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0b0b0b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

function createBackdatedWindow() {
  const existing = BrowserWindow.getAllWindows().find((win) => win.getTitle() === 'NDDC Backdated Entry Portal');
  if (existing) {
    existing.focus();
    return;
  }
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#0b0b0b',
    title: 'NDDC Backdated Entry Portal',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, '..', 'BackdatedPortal.html'));
}

app.whenReady().then(() => {
  initDatabase();
  registerIpcHandlers();
  ipcMain.handle('app:openBackdatedPortal', () => {
    createBackdatedWindow();
    return { ok: true };
  });
  startBackgroundSync();
  startEmailWorker();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
