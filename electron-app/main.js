/**
 * Joel Media Studio Pro — Electron Main Process
 * Handles: window creation, ffmpeg RTMP streaming, IPC bridges
 */

const { app, BrowserWindow, ipcMain, desktopCapturer, shell, dialog } = require('electron');
const path   = require('path');
const { spawn } = require('child_process');
const fs     = require('fs');

// Get ffmpeg binary path (bundled via ffmpeg-static)
let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
} catch(e) {
  ffmpegPath = 'ffmpeg'; // fall back to system ffmpeg
}

let mainWindow;
let ffmpegProcesses = {}; // pid → ChildProcess, keyed by platform id

/* ─────────────────────────────────────────────
   WINDOW
───────────────────────────────────────────── */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#080c10',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,          // allow local file access for screen capture
      allowRunningInsecureContent: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    // Kill all ffmpeg processes when window closes
    stopAllFfmpeg();
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  stopAllFfmpeg();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/* ─────────────────────────────────────────────
   FFMPEG RTMP STREAMING
   Receives: { platformId, rtmpUrl, streamKey, source, quality }
   source: 'screen' | 'webcam' | 'both'
   quality: '1080' | '720' | '480'
───────────────────────────────────────────── */
ipcMain.handle('stream:start', async (event, opts) => {
  const { platformId, rtmpUrl, streamKey, source, quality } = opts;
  const fullUrl = rtmpUrl.endsWith('/') ? rtmpUrl + streamKey : rtmpUrl + '/' + streamKey;

  if (ffmpegProcesses[platformId]) {
    return { ok: false, error: 'Already streaming on ' + platformId };
  }

  // Map quality to ffmpeg settings
  const qmap = {
    '1080': { res: '1920x1080', fps: '60', br: '6000k', aac: '192k' },
    '720':  { res: '1280x720',  fps: '30', br: '4000k', aac: '128k' },
    '480':  { res: '854x480',   fps: '30', br: '2000k', aac: '96k'  }
  };
  const q = qmap[quality] || qmap['720'];

  // Build ffmpeg args based on platform
  let inputArgs = [];

  if (process.platform === 'win32') {
    if (source === 'screen' || source === 'both') {
      inputArgs = [
        '-f', 'gdigrab',
        '-framerate', q.fps,
        '-i', 'desktop',
        '-f', 'dshow',
        '-i', 'audio=virtual-audio-capturer'
      ];
    } else {
      // webcam
      inputArgs = [
        '-f', 'dshow',
        '-framerate', q.fps,
        '-video_size', q.res,
        '-i', 'video=0:audio=0'
      ];
    }
  } else if (process.platform === 'darwin') {
    if (source === 'screen' || source === 'both') {
      inputArgs = [
        '-f', 'avfoundation',
        '-framerate', q.fps,
        '-i', '1:0'  // screen:microphone
      ];
    } else {
      inputArgs = [
        '-f', 'avfoundation',
        '-framerate', q.fps,
        '-i', '0:0'  // camera:mic
      ];
    }
  } else {
    // Linux
    inputArgs = [
      '-f', 'x11grab',
      '-framerate', q.fps,
      '-i', process.env.DISPLAY + '+0,0',
      '-f', 'pulse',
      '-i', 'default'
    ];
  }

  const outputArgs = [
    '-vf',    `scale=${q.res}`,
    '-vcodec', 'libx264',
    '-preset', 'veryfast',
    '-tune',   'zerolatency',
    '-b:v',    q.br,
    '-maxrate', q.br,
    '-bufsize', '2000k',
    '-pix_fmt', 'yuv420p',
    '-g',      String(parseInt(q.fps) * 2),
    '-acodec', 'aac',
    '-b:a',    q.aac,
    '-ar',     '44100',
    '-f',      'flv',
    fullUrl
  ];

  const args = [...inputArgs, ...outputArgs];

  console.log('[ffmpeg]', ffmpegPath, args.join(' '));

  const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  ffmpegProcesses[platformId] = proc;

  let stderr = '';
  proc.stderr.on('data', (d) => {
    stderr += d.toString();
    // Send progress back to renderer
    if (mainWindow) {
      mainWindow.webContents.send('stream:progress', {
        platformId,
        log: d.toString()
      });
    }
  });

  proc.on('close', (code) => {
    delete ffmpegProcesses[platformId];
    if (mainWindow) {
      mainWindow.webContents.send('stream:ended', { platformId, code });
    }
  });

  proc.on('error', (err) => {
    delete ffmpegProcesses[platformId];
    if (mainWindow) {
      mainWindow.webContents.send('stream:error', { platformId, error: err.message });
    }
  });

  return { ok: true, pid: proc.pid };
});

ipcMain.handle('stream:stop', async (event, { platformId }) => {
  const proc = ffmpegProcesses[platformId];
  if (!proc) return { ok: false, error: 'Not streaming' };
  proc.kill('SIGINT');
  delete ffmpegProcesses[platformId];
  return { ok: true };
});

ipcMain.handle('stream:stopAll', async () => {
  stopAllFfmpeg();
  return { ok: true };
});

function stopAllFfmpeg() {
  Object.values(ffmpegProcesses).forEach(p => { try { p.kill('SIGINT'); } catch(e){} });
  ffmpegProcesses = {};
}

/* ─────────────────────────────────────────────
   RECORDING (save to disk)
───────────────────────────────────────────── */
ipcMain.handle('record:start', async (event, opts) => {
  const { source, quality, outputPath } = opts;
  const qmap = {
    '1080': { res: '1920x1080', fps: '60', br: '8000k' },
    '720':  { res: '1280x720',  fps: '30', br: '5000k' },
    '480':  { res: '854x480',   fps: '30', br: '2500k' }
  };
  const q = qmap[quality] || qmap['720'];

  let inputArgs = [];
  if (process.platform === 'win32') {
    inputArgs = ['-f','gdigrab','-framerate',q.fps,'-i','desktop','-f','dshow','-i','audio=virtual-audio-capturer'];
  } else if (process.platform === 'darwin') {
    inputArgs = ['-f','avfoundation','-framerate',q.fps,'-i','1:0'];
  } else {
    inputArgs = ['-f','x11grab','-framerate',q.fps,'-i',process.env.DISPLAY+'+0,0','-f','pulse','-i','default'];
  }

  const out = outputPath || path.join(app.getPath('videos'), 'JMS-Recording-' + Date.now() + '.mp4');

  const args = [
    ...inputArgs,
    '-vf', `scale=${q.res}`,
    '-vcodec', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-acodec', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    out
  ];

  const proc = spawn(ffmpegPath, args, { stdio: ['ignore','pipe','pipe'] });
  ffmpegProcesses['__record'] = proc;

  proc.on('close', () => {
    delete ffmpegProcesses['__record'];
    if (mainWindow) mainWindow.webContents.send('record:saved', { path: out });
  });

  return { ok: true, outputPath: out };
});

ipcMain.handle('record:stop', async () => {
  const proc = ffmpegProcesses['__record'];
  if (!proc) return { ok: false };
  proc.stdin.write('q\n');
  setTimeout(() => { try { proc.kill('SIGINT'); } catch(e){} }, 1000);
  return { ok: true };
});

/* ─────────────────────────────────────────────
   DESKTOP CAPTURE SOURCES LIST
───────────────────────────────────────────── */
ipcMain.handle('capture:getSources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 320, height: 180 }
  });
  return sources.map(s => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL()
  }));
});

/* ─────────────────────────────────────────────
   SAVE FILE DIALOG
───────────────────────────────────────────── */
ipcMain.handle('dialog:saveFile', async (event, opts) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: opts.defaultPath || path.join(app.getPath('videos'), 'recording.mp4'),
    filters: opts.filters || [{ name: 'Video', extensions: ['mp4', 'webm', 'mkv'] }]
  });
  return result;
});

/* ─────────────────────────────────────────────
   OPEN EXTERNAL URLS
───────────────────────────────────────────── */
ipcMain.handle('shell:openExternal', async (event, url) => {
  await shell.openExternal(url);
});

/* ─────────────────────────────────────────────
   APP INFO
───────────────────────────────────────────── */
ipcMain.handle('app:getVersion', () => app.getVersion());
ipcMain.handle('app:getPlatform', () => process.platform);
ipcMain.handle('app:getFfmpegPath', () => ffmpegPath);
