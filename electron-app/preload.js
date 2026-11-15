/**
 * Joel Media Studio Pro — Preload Script
 * Exposes safe IPC bridge to the renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jmsAPI', {

  // ── STREAMING ──────────────────────────────────
  streamStart:    (opts)         => ipcRenderer.invoke('stream:start', opts),
  streamStop:     (platformId)   => ipcRenderer.invoke('stream:stop', { platformId }),
  streamStopAll:  ()             => ipcRenderer.invoke('stream:stopAll'),

  onStreamProgress: (cb) => ipcRenderer.on('stream:progress', (e, data) => cb(data)),
  onStreamEnded:    (cb) => ipcRenderer.on('stream:ended',    (e, data) => cb(data)),
  onStreamError:    (cb) => ipcRenderer.on('stream:error',    (e, data) => cb(data)),

  // ── RECORDING ──────────────────────────────────
  recordStart:    (opts) => ipcRenderer.invoke('record:start', opts),
  recordStop:     ()     => ipcRenderer.invoke('record:stop'),
  onRecordSaved:  (cb)   => ipcRenderer.on('record:saved', (e, data) => cb(data)),

  // ── CAPTURE SOURCES ────────────────────────────
  getCaptureSources: () => ipcRenderer.invoke('capture:getSources'),

  // ── DIALOGS ────────────────────────────────────
  saveFileDialog: (opts) => ipcRenderer.invoke('dialog:saveFile', opts),

  // ── SHELL ──────────────────────────────────────
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // ── APP INFO ───────────────────────────────────
  getVersion:    () => ipcRenderer.invoke('app:getVersion'),
  getPlatform:   () => ipcRenderer.invoke('app:getPlatform'),
  getFfmpegPath: () => ipcRenderer.invoke('app:getFfmpegPath'),

  // ── REMOVE LISTENERS ───────────────────────────
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
