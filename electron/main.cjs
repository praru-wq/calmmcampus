// CalmCampus Windows desktop wrapper.
// Loads the live Render deployment in a chromeless BrowserWindow.
// No API keys are bundled. The Render backend owns /api/talk and provider keys.
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

const PUBLIC_APP_URL =
  process.env.PUBLIC_APP_URL || 'https://calmcampus.onrender.com';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 360,
    minHeight: 600,
    title: 'CalmCampus',
    autoHideMenuBar: true,
    backgroundColor: '#FFF8F0',
    icon: path.join(__dirname, '..', 'resources', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);
  win.setMenuBarVisibility(false);

  win.loadURL(PUBLIC_APP_URL);

  // Open external links in the user's default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      const allowed = new URL(PUBLIC_APP_URL);
      if (target.origin !== allowed.origin) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
    } catch {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    try {
      const target = new URL(url);
      const allowed = new URL(PUBLIC_APP_URL);
      if (target.origin !== allowed.origin) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
