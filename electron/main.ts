import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  session,
  shell,
  type MenuItemConstructorOptions,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { pathToFileURL } from 'node:url';

const DEV_URL = process.env.LUMINA_DEV_URL;
const isDev = Boolean(DEV_URL);
const appRoot = path.join(__dirname, '..');
const distDir = path.join(appRoot, 'dist');
const supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif', '.svg']);

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'lumina',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let pendingPaths: string[] = [];

function isImagePath(candidate: string): boolean {
  return supportedExtensions.has(path.extname(candidate).toLowerCase());
}

function collectPaths(argv: string[]): string[] {
  return argv
    .slice(1)
    .filter((argument) => !argument.startsWith('-') && isImagePath(argument) && existsSync(argument));
}

async function readImageFiles(paths: string[]) {
  const entries: Array<{ path: string; name: string; data: ArrayBuffer }> = [];
  for (const filePath of paths) {
    try {
      const buffer = await fs.readFile(filePath);
      const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
      entries.push({ path: filePath, name: path.basename(filePath), data });
    } catch (error) {
      console.warn('[lumina] não foi possível ler', filePath, error);
    }
  }
  return entries;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.bin': 'application/octet-stream',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

let fallbackServer: Server | null = null;

/**
 * Last-resort static server on 127.0.0.1, used only if the custom
 * `lumina://` protocol fails to load. Keeps the app usable instead of
 * showing a blank window on exotic Windows/antivirus configurations.
 */
function startFallbackServer(): Promise<string> {
  if (fallbackServer) {
    const address = fallbackServer.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    return Promise.resolve(`http://127.0.0.1:${port}/index.html`);
  }
  return new Promise((resolve, reject) => {
    const server = createServer(async (request, response) => {
      try {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');
        const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
        const target = path.normalize(path.join(distDir, relative));
        if (!target.startsWith(distDir) || !existsSync(target)) {
          response.writeHead(404).end('Não encontrado');
          return;
        }
        response.writeHead(200, {
          'Content-Type': MIME_TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'credentialless',
        });
        createReadStream(target).pipe(response);
      } catch {
        response.writeHead(500).end('Erro interno');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      fallbackServer = server;
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve(`http://127.0.0.1:${port}/index.html`);
    });
  });
}

function registerProtocol(): void {
  protocol.handle('lumina', async (request) => {
    try {
      const url = new URL(request.url);
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const target = path.normalize(path.join(distDir, relative));
      if (!target.startsWith(distDir)) {
        return new Response('Proibido', { status: 403 });
      }
      return await net.fetch(pathToFileURL(target).toString());
    } catch {
      return new Response('Não encontrado', { status: 404 });
    }
  });
}

function registerIpc(): void {
  ipcMain.handle('dialog:openImages', async () => {
    const window = BrowserWindow.getFocusedWindow() ?? mainWindow;
    if (!window) return [];
    const result = await dialog.showOpenDialog(window, {
      title: 'Abrir imagens',
      buttonLabel: 'Abrir',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'svg'] },
        { name: 'Todos os arquivos', extensions: ['*'] },
      ],
    });
    if (result.canceled) return [];
    return readImageFiles(result.filePaths.filter(isImagePath));
  });

  ipcMain.handle('file:saveImage', async (_event, payload: { data: ArrayBuffer; fileName: string }) => {
    const window = BrowserWindow.getFocusedWindow() ?? mainWindow;
    if (!window) return { saved: false, error: 'Janela indisponível.' };
    const extension = path.extname(payload.fileName) || '.png';
    const filterName =
      extension === '.jpg' || extension === '.jpeg' ? 'JPEG' : extension === '.webp' ? 'WEBP' : 'PNG';
    const result = await dialog.showSaveDialog(window, {
      title: 'Salvar imagem editada',
      defaultPath: path.join(app.getPath('pictures'), payload.fileName),
      buttonLabel: 'Salvar',
      filters: [
        { name: filterName, extensions: [extension.replace('.', '')] },
        { name: 'Todos os arquivos', extensions: ['*'] },
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    });
    if (result.canceled || !result.filePath) return { saved: false };
    try {
      await fs.writeFile(result.filePath, Buffer.from(payload.data));
      return { saved: true, path: result.filePath, fileName: path.basename(result.filePath) };
    } catch (error) {
      return {
        saved: false,
        error: error instanceof Error ? error.message : 'Não foi possível gravar o arquivo.',
      };
    }
  });

  ipcMain.handle('shell:reveal', async (_event, target: string) => {
    shell.showItemInFolder(target);
  });

  ipcMain.handle('window:toggleFullscreen', async () => {
    const window = BrowserWindow.getFocusedWindow() ?? mainWindow;
    if (!window) return false;
    const next = !window.isFullScreen();
    window.setFullScreen(next);
    return next;
  });

  ipcMain.handle('app:version', async () => app.getVersion());

  ipcMain.handle('files:pending', async () => {
    const paths = pendingPaths;
    pendingPaths = [];
    return readImageFiles(paths);
  });
}

function buildMenu(): void {
  const send = (channel: string) => {
    BrowserWindow.getFocusedWindow()?.webContents.send(channel);
  };

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Abrir imagens…', accelerator: 'CmdOrCtrl+O', click: () => send('menu:open') },
        { label: 'Salvar como…', accelerator: 'CmdOrCtrl+S', click: () => send('menu:save') },
        { type: 'separator' },
        { role: 'quit', label: 'Sair' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Desfazer', accelerator: 'CmdOrCtrl+Z', click: () => send('menu:undo') },
        { label: 'Refazer', accelerator: 'CmdOrCtrl+Shift+Z', click: () => send('menu:redo') },
        { type: 'separator' },
        { label: 'Atalhos de teclado', accelerator: 'F1', click: () => send('menu:shortcuts') },
      ],
    },
    {
      label: 'Exibir',
      submenu: [
        { role: 'togglefullscreen', label: 'Tela cheia' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Redefinir zoom da interface' },
        { role: 'zoomIn', label: 'Aumentar interface' },
        { role: 'zoomOut', label: 'Diminuir interface' },
        ...(isDev
          ? ([{ type: 'separator' }, { role: 'reload', label: 'Recarregar' }, { role: 'toggleDevTools', label: 'Ferramentas do desenvolvedor' }] as MenuItemConstructorOptions[])
          : []),
      ],
    },
    {
      label: 'Ajuda',
      submenu: [
        { label: 'Sobre o Lumina', click: () => {
          if (!mainWindow) return;
          void dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Sobre o Lumina',
            message: `Lumina Fotos ${app.getVersion()}`,
            detail:
              'Visualizador e editor de fotos com upscale por IA local (ESRGAN-Slim + TensorFlow.js).\n\nTodo o processamento acontece no seu computador — nenhuma imagem é enviada para servidores.',
            buttons: ['Fechar'],
          });
        } },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 980,
    minHeight: 660,
    show: false,
    backgroundColor: '#0a0b0d',
    title: 'Lumina Fotos',
    icon: path.join(appRoot, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  window.once('ready-to-show', () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (isDev && url.startsWith(DEV_URL!)) return;
    if (url.startsWith('lumina://')) return;
    event.preventDefault();
  });

  if (isDev) {
    void window.loadURL(DEV_URL!);
  } else {
    let recovered = false;
    window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      // -3 = ERR_ABORTED (navegação cancelada de propósito, ignoramos)
      if (recovered || errorCode === -3 || !validatedURL.startsWith('lumina://')) return;
      recovered = true;
      console.warn('[lumina] falha ao carregar lumina://:', errorCode, errorDescription);
      void startFallbackServer()
        .then((url) => {
          console.warn('[lumina] usando servidor local de contingência em', url);
          return window.loadURL(url);
        })
        .catch((error) => {
          console.error('[lumina] não foi possível iniciar o servidor de contingência:', error);
          void dialog.showErrorBox(
            'Lumina não conseguiu iniciar',
            'Feche o aplicativo e tente novamente. Se o problema persistir, reinstale o Lumina Fotos.',
          );
        });
    });
    void window.loadURL('lumina://app/index.html');
  }

  mainWindow = window;
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });

  return window;
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const files = collectPaths(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (files.length) {
        void readImageFiles(files).then((entries) => mainWindow?.webContents.send('files:opened', entries));
      }
    }
  });

  app.whenReady().then(() => {
    pendingPaths = collectPaths(process.argv);
    registerProtocol();
    registerIpc();
    buildMenu();
    createWindow();

    if (!isDev) {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'",
            ],
          },
        });
      });
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('before-quit', () => {
    fallbackServer?.close();
    fallbackServer = null;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
