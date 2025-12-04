import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';
const DEV_SERVER_URL = 'http://localhost:3000';

// Persistent storage
const store = new Store();

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'Media Conductor',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0a0a0a',
    show: false, // Show when ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for some Node.js APIs in preload
    },
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (isProd) {
    // Production: serve built Next.js app
    const servePath = path.join(__dirname, '../.next');
    // Using electron-serve or custom server
    await mainWindow.loadFile(path.join(servePath, 'server/app/index.html'));
  } else {
    // Development: connect to Next.js dev server
    await mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================
// IPC Handlers
// ============================================

// App info
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:platform', () => process.platform);
ipcMain.handle('app:isPackaged', () => app.isPackaged);

// Dialog handlers
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:selectFile', async (_event, filters?: Electron.FileFilter[]) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: filters || [],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (_event, defaultPath?: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath,
  });
  return result.canceled ? null : result.filePath;
});

// Store handlers (persistent key-value storage)
ipcMain.handle('store:get', (_event, key: string) => store.get(key));
ipcMain.handle('store:set', (_event, key: string, value: unknown) => store.set(key, value));
ipcMain.handle('store:delete', (_event, key: string) => store.delete(key));

// ============================================
// App Lifecycle
// ============================================

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

// Security: Prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, _url) => {
    // Prevent navigation away from the app in production
    if (isProd) {
      event.preventDefault();
    }
  });
});
