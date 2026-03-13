const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const express = require('express');

let mainWindow;
const PORT = 45321; // porta interna para servir os arquivos estáticos

function createStaticServer() {
  const server = express();
  const distPath = path.join(__dirname, 'dist');
  
  server.use(express.static(distPath));
  
  // SPA fallback — todas as rotas retornam index.html
  server.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Static server running on http://127.0.0.1:${PORT}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Sistema de Senhas',
    icon: path.join(__dirname, 'public', 'favicon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Esconder menu
  Menu.setApplicationMenu(null);

  // Carregar do servidor estático local
  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createStaticServer();
  // Pequeno delay para o servidor subir
  setTimeout(createWindow, 500);
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
