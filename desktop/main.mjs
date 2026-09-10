// Electron entry point. The window shows the same Next.js app as the website; a
// private copy of its server runs in a background process so the API route
// (the OpenAI / Groq proxy) keeps working with no size limit in front of it.

import {
  app,
  BrowserWindow,
  Menu,
  dialog,
  nativeTheme,
  net,
  protocol,
  shell,
  utilityProcess,
} from "electron";
import { connect, createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Transcripts live in IndexedDB, which the browser keys by origin, and the
 * profile lives in the userData folder. Changing either one makes every saved
 * transcript disappear for existing users — so neither follows the port the
 * server happens to get, nor the product name.
 */
const ORIGIN = "app://scribe";
const DATA_FOLDER = "Scribe";

const devUrl = process.argv.find((arg) => arg.startsWith("--dev-url="))?.slice("--dev-url=".length);

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      codeCache: true,
    },
  },
]);

app.setPath("userData", path.join(app.getPath("appData"), DATA_FOLDER));

/** @type {Electron.UtilityProcess | null} */
let server = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;
let quitting = false;

function serverEntry() {
  if (app.isPackaged) return path.join(process.resourcesPath, "standalone", "server.js");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  return path.join(root, ".next", "standalone", "server.js");
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = /** @type {import("node:net").AddressInfo} */ (probe.address());
      probe.close(() => resolve(port));
    });
  });
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = connect(port, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function waitUntilListening(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await canConnect(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`The app server did not start within ${timeoutMs / 1000} seconds.`);
}

/** Starts the Next.js server on a free loopback port and resolves to its URL. */
async function startServer() {
  const port = await freePort();
  const child = utilityProcess.fork(serverEntry(), [], {
    serviceName: "Scribe server",
    stdio: "pipe",
    env: { ...process.env, NODE_ENV: "production", PORT: String(port), HOSTNAME: "127.0.0.1" },
  });
  const log = [];
  const keep = (chunk) => {
    log.push(String(chunk));
    if (log.length > 50) log.shift();
  };
  child.stdout?.on("data", keep);
  child.stderr?.on("data", keep);
  const describeExit = (code) =>
    `The background server exited with code ${code}.\n\n${log.join("").slice(-2000)}`;

  let started = false;
  const failedToStart = new Promise((_, reject) => {
    child.on("exit", (code) => {
      server = null;
      if (!started) {
        reject(new Error(describeExit(code)));
        return;
      }
      if (quitting) return;
      console.error(describeExit(code));
      dialog.showErrorBox("Scribe stopped unexpectedly", describeExit(code));
      app.quit();
    });
  });
  server = child;

  await Promise.race([waitUntilListening(port), failedToStart]);
  started = true;
  return `http://127.0.0.1:${port}`;
}

/** Serves every app:// request from the local server, keeping the origin fixed. */
function routeAppScheme(serverUrl) {
  protocol.handle("app", (request) => {
    const { pathname, search } = new URL(request.url);
    // Forwarded as-is, `Origin: app://scribe` makes Chromium treat the hop to
    // 127.0.0.1 as cross-origin and drop the response — which breaks font
    // preloads and every POST. The server is only reachable through here.
    const headers = new Headers(request.headers);
    headers.delete("origin");
    return net.fetch(`${serverUrl}${pathname}${search}`, {
      method: request.method,
      headers,
      body: request.body,
      duplex: "half",
      bypassCustomProtocolHandlers: true,
    });
  });
}

function createWindow(startUrl) {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0b0b0f" : "#f6f6f8",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once("ready-to-show", () => win.show());

  // Links open in the real browser; the window itself never leaves the app.
  const appOrigin = new URL(startUrl).origin;
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== appOrigin) event.preventDefault();
  });

  // The page asks for confirmation while a transcription runs. Browsers show
  // that prompt themselves; Electron only reports it, so ask here.
  win.webContents.on("will-prevent-unload", (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: "warning",
      buttons: ["Quit anyway", "Keep working"],
      defaultId: 1,
      cancelId: 1,
      message: "A transcription is still running.",
      detail: "Closing now cancels it. Finished transcripts are already saved.",
    });
    if (choice === 0) event.preventDefault();
  });

  win.webContents.on("context-menu", (_event, params) => {
    const template = params.isEditable
      ? [{ role: "cut" }, { role: "copy" }, { role: "paste" }, { type: "separator" }, { role: "selectAll" }]
      : params.selectionText
        ? [{ role: "copy" }, { type: "separator" }, { role: "selectAll" }]
        : [];
    if (template.length > 0) Menu.buildFromTemplate(template).popup({ window: win });
  });

  void win.loadURL(startUrl);
  return win;
}

if (!app.requestSingleInstanceLock()) {
  // A second copy would fight the first over the same saved data.
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    let startUrl = devUrl;
    if (!startUrl) {
      try {
        routeAppScheme(await startServer());
        startUrl = `${ORIGIN}/`;
      } catch (error) {
        console.error(error);
        dialog.showErrorBox("Scribe could not start", String(error?.message ?? error));
        app.quit();
        return;
      }
    }

    mainWindow = createWindow(startUrl);
    mainWindow.on("closed", () => (mainWindow = null));

    app.on("activate", () => {
      if (!mainWindow) {
        mainWindow = createWindow(startUrl);
        mainWindow.on("closed", () => (mainWindow = null));
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    quitting = true;
    server?.kill();
  });
}
