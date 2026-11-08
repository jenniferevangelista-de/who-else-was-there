// Preload: the SmartSpectra bridge plus a few calls of our own. Bundled into dist/preload.cjs,
// because a sandboxed preload cannot load node_modules.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
require('@smartspectra/node-sdk/preload');
contextBridge.exposeInMainWorld('pod', {
  key: () => ipcRenderer.invoke('pod:key'),
  info: () => ipcRenderer.invoke('pod:info'),
});
