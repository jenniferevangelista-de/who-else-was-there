// Electron main process for Ghost Hunt: Who Else Was There?
//  - hosts the SmartSpectra SDK through the package's IPC binding (frames stay on this computer)
//  - hands the API key from the PRESAGE_API_KEY environment variable to our own page only
//  - grants the camera (video only, never the microphone) to our own bundled page only
//  - --replay runs the story on sample numbers, with no camera and no SDK
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, ipcMain, session } = require('electron');

const REPLAY = process.argv.includes('--replay') || !process.env.PRESAGE_API_KEY;
const CASE_VIDEO = path.join(__dirname, '..', 'case', 'the-door.mp4');

if (app.isPackaged && !process.env.SMARTSPECTRA_CAPI_PATH) {
  const LIB = { darwin: 'libsmartspectra_capi.dylib', win32: 'smartspectra_capi.dll', linux: 'libsmartspectra_capi.so' }[process.platform];
  if (LIB) process.env.SMARTSPECTRA_CAPI_PATH = path.join(process.resourcesPath, 'smartspectra', LIB);
}

const PAGE = path.join(__dirname, 'renderer', 'index.html');
const ownPage = (url) => typeof url === 'string' && url.startsWith('file://') && decodeURIComponent(url).replace(/\\/g, '/').includes('/app/renderer/');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1100, minHeight: 720, backgroundColor: '#120a1f', title: 'Ghost Hunt: Who Else Was There?',
    webPreferences: { preload: path.join(__dirname, '..', 'dist', 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  if (!REPLAY) require('@smartspectra/node-sdk/main').bindSmartSpectraIpc(win);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.setMenuBarVisibility(false);
  win.loadFile(PAGE);
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    const types = (details && details.mediaTypes) || [];
    callback(!REPLAY && permission === 'media' && types.length === 1 && types[0] === 'video' && ownPage(details && details.requestingUrl));
  });
  // The key goes from the environment to our page, in memory. It is never written or logged here.
  ipcMain.handle('pod:key', (e) => (!REPLAY && ownPage(e.senderFrame && e.senderFrame.url) ? process.env.PRESAGE_API_KEY : null));
  ipcMain.handle('pod:info', () => ({
    replay: REPLAY, hasKey: !!process.env.PRESAGE_API_KEY, platform: process.platform,
    caseVideo: fs.existsSync(CASE_VIDEO) ? 'file://' + CASE_VIDEO.replace(/\\/g, '/') : null,
  }));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => app.quit());
