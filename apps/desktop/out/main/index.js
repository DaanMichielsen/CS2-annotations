"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const Store = require("electron-store");
const shared = require("@cs2ann/shared");
function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
let currentFileWatcher = null;
const store = new Store();
const CS2_SERVER_ANNOTATION_LINES = "sv_cheats 1\nsv_allow_annotations_access_level 2";
const CS2_ANNOTATIONS_RELATIVE = "steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\annotations\\local";
const CS2_WORKSHOP_CONTENT_RELATIVE = "steamapps\\workshop\\content\\730";
function getSteamPathFromRegistry() {
  return new Promise((resolve) => {
    if (process.platform !== "win32") {
      resolve(null);
      return;
    }
    try {
      child_process.execFile(
        "reg",
        ["query", "HKEY_CURRENT_USER\\Software\\Valve\\Steam", "/v", "SteamPath", "/t", "REG_SZ"],
        { encoding: "utf8" },
        (err, stdout) => {
          if (err) {
            child_process.execFile(
              "reg",
              ["query", "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Valve\\Steam", "/v", "InstallPath", "/t", "REG_SZ"],
              { encoding: "utf8" },
              (err2, stdout2) => {
                if (err2) {
                  resolve(null);
                  return;
                }
                const match2 = stdout2.match(/InstallPath\s+REG_SZ\s+(.+)/);
                resolve(match2 ? match2[1].trim() : null);
              }
            );
            return;
          }
          const match = stdout.match(/SteamPath\s+REG_SZ\s+(.+)/);
          resolve(match ? match[1].trim() : null);
        }
      );
    } catch {
      resolve(null);
    }
  });
}
function deriveAnnotationsRoot(steamPath) {
  return path.join(steamPath, CS2_ANNOTATIONS_RELATIVE);
}
function deriveWorkshopContentPath(steamPath) {
  return path.join(steamPath, CS2_WORKSHOP_CONTENT_RELATIVE);
}
const KV3_HEADER_PREFIX = "<!-- kv3 encoding:text:version{";
const FEATURED_GUIDES = [
  { id: "3387810001", name: "inferno_essential" },
  { id: "3387870747", name: "ancient_essential" },
  { id: "3388581972", name: "anubis_essential" },
  { id: "3388611848", name: "overpass_essential" },
  { id: "3388638091", name: "nuke_essential" },
  { id: "3388681214", name: "dust2_essential" },
  { id: "3388737112", name: "mirage_essential" },
  { id: "3388761697", name: "vertigo_essential" }
];
function fileIsAnnotation(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(256);
    const bytesRead = fs.readSync(fd, buf, 0, 256, 0);
    fs.closeSync(fd);
    const firstLine = buf.slice(0, bytesRead).toString("utf-8").replace(/^﻿/, "").split("\n")[0];
    return firstLine.trimEnd().startsWith(KV3_HEADER_PREFIX);
  } catch {
    return false;
  }
}
function readMapName(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8").replace(/^﻿/, "");
    const lines = raw.split("\n").slice(0, 10);
    for (const line of lines) {
      const m = line.match(/MapName\s*=\s*"([^"]*)"/);
      if (m) return m[1] || void 0;
    }
  } catch {
  }
  return void 0;
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 1e3,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.NODE_ENV === "development" || process.env.ELECTRON_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_VITE_DEV_SERVER_URL ?? "http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../out/renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  createWindow();
  const annotationsRoot = store.get("annotationsRoot", "");
  if (annotationsRoot) {
    try {
      const cfgDir = path.resolve(path.join(annotationsRoot, "../../cfg"));
      if (fs.existsSync(cfgDir)) {
        const cfgFile = path.join(cfgDir, "annotation_manager.cfg");
        fs.writeFileSync(cfgFile, CS2_SERVER_ANNOTATION_LINES + "\n", "utf-8");
      }
    } catch {
    }
  }
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.ipcMain.handle("getAnnotationsRoot", () => {
  return store.get("annotationsRoot", "");
});
electron.ipcMain.handle("setAnnotationsRoot", (_event, root) => {
  store.set("annotationsRoot", root);
});
electron.ipcMain.handle("getWorkshopContentPath", () => {
  return store.get("workshopContentPath", "");
});
electron.ipcMain.handle("setWorkshopContentPath", (_event, p) => {
  store.set("workshopContentPath", p);
});
electron.ipcMain.handle("getAutoCopyLoadCommandsOnOpen", () => {
  return store.get("autoCopyLoadCommandsOnOpen", false);
});
electron.ipcMain.handle("setAutoCopyLoadCommandsOnOpen", (_event, value) => {
  store.set("autoCopyLoadCommandsOnOpen", value);
});
electron.ipcMain.handle(
  "detectSteamPath",
  async () => {
    const steamPath = await getSteamPathFromRegistry();
    if (!steamPath) {
      const fallback = "C:\\Program Files (x86)\\Steam";
      if (fs.existsSync(fallback)) {
        const annotationsRoot2 = deriveAnnotationsRoot(fallback);
        const workshopContentPath2 = deriveWorkshopContentPath(fallback);
        return { path: fallback, annotationsRoot: annotationsRoot2, workshopContentPath: workshopContentPath2 };
      }
      return { error: "Steam path not found in registry. Set the folders manually." };
    }
    const annotationsRoot = deriveAnnotationsRoot(steamPath);
    const workshopContentPath = deriveWorkshopContentPath(steamPath);
    return { path: steamPath, annotationsRoot, workshopContentPath };
  }
);
function getAnnotationsRootPath() {
  const root = store.get("annotationsRoot", "");
  if (!root) throw new Error("Annotations folder not set. Set it in Settings.");
  return root;
}
const UTF8_BOM = "\uFEFF";
function writeAnnotationFile(filePath, content) {
  fs.writeFileSync(filePath, UTF8_BOM + content, "utf-8");
}
function toLocalGuideName(input) {
  return input.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}
electron.ipcMain.handle(
  "listGuides",
  async () => {
    const guides = [];
    const annotationsRoot = store.get("annotationsRoot", "");
    if (annotationsRoot && fs.existsSync(annotationsRoot)) {
      const entries = fs.readdirSync(annotationsRoot, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const txtPath = path.join(annotationsRoot, e.name, `${e.name}.txt`);
        if (!fs.existsSync(txtPath)) continue;
        guides.push({
          name: e.name,
          path: txtPath,
          source: "local",
          mapName: readMapName(txtPath),
          installed: true
        });
      }
    }
    const workshopPath = store.get("workshopContentPath", "");
    for (const fg of FEATURED_GUIDES) {
      const folderPath = workshopPath ? path.join(workshopPath, fg.id) : "";
      if (!folderPath || !fs.existsSync(folderPath)) {
        guides.push({ name: fg.name, path: "", source: "workshop", workshopId: fg.id, installed: false });
        continue;
      }
      let found = false;
      try {
        const files = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const f of files) {
          if (!f.isFile() || path.extname(f.name).toLowerCase() !== ".txt") continue;
          const fullPath = path.join(folderPath, f.name);
          if (!fileIsAnnotation(fullPath)) continue;
          guides.push({
            name: fg.name,
            path: fullPath,
            source: "workshop",
            mapName: readMapName(fullPath),
            workshopId: fg.id,
            installed: true
          });
          found = true;
          break;
        }
      } catch {
      }
      if (!found) {
        guides.push({ name: fg.name, path: "", source: "workshop", workshopId: fg.id, installed: false });
      }
    }
    if (workshopPath && fs.existsSync(workshopPath)) {
      const featuredIds = new Set(FEATURED_GUIDES.map((g) => g.id));
      const dirs = fs.readdirSync(workshopPath, { withFileTypes: true });
      for (const d of dirs) {
        if (!d.isDirectory() || featuredIds.has(d.name)) continue;
        const folderPath = path.join(workshopPath, d.name);
        try {
          const files = fs.readdirSync(folderPath, { withFileTypes: true });
          for (const f of files) {
            if (!f.isFile() || path.extname(f.name).toLowerCase() !== ".txt") continue;
            const fullPath = path.join(folderPath, f.name);
            if (!fileIsAnnotation(fullPath)) continue;
            const baseName = path.basename(f.name, ".txt");
            guides.push({
              name: `${d.name} - ${baseName}`,
              path: fullPath,
              source: "workshop",
              mapName: readMapName(fullPath),
              workshopId: d.name,
              installed: true
            });
            break;
          }
        } catch {
        }
      }
    }
    return guides;
  }
);
electron.ipcMain.handle(
  "loadGuide",
  async (_event, filePath) => {
    try {
      if (!fs.existsSync(filePath)) return { error: `File not found: ${filePath}` };
      let raw = fs.readFileSync(filePath, "utf-8");
      const hadBom = raw.charCodeAt(0) === 65279;
      if (hadBom) raw = raw.slice(1);
      const hasKv3Header = raw.trimStart().startsWith("<!--");
      const root = shared.parseKv3Text(raw);
      const nodesKey = shared.extractNodesKey(root);
      const nodes = shared.kv3ToNodes(root, nodesKey);
      if (!hadBom || !hasKv3Header) {
        writeAnnotationFile(filePath, shared.serializeKv3Text(root));
      }
      return { nodes, nodesKey, root };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
);
electron.ipcMain.handle(
  "createGuide",
  async (_event, filename, mapName) => {
    try {
      const rootPath = getAnnotationsRootPath();
      const safeName = toLocalGuideName(filename);
      if (!safeName) return { error: "Invalid guide name. Use letters, numbers, underscores or hyphens (no spaces)." };
      const dirPath = path.join(rootPath, safeName);
      const filePath = path.join(dirPath, `${safeName}.txt`);
      if (fs.existsSync(filePath)) return { error: `Guide "${safeName}" already exists.` };
      fs.mkdirSync(dirPath, { recursive: true });
      const root = { MapName: mapName ?? "", ScreenText: {}, Nodes: [] };
      const out = shared.serializeKv3Text(root);
      writeAnnotationFile(filePath, out);
      return { loadName: safeName };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
);
electron.ipcMain.handle(
  "saveGuide",
  async (_event, payload) => {
    try {
      const filePath = payload.filePath;
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
      if (payload.createBackup !== false && fs.existsSync(filePath)) {
        const bakPath = filePath + ".bak";
        fs.copyFileSync(filePath, bakPath);
      }
      shared.setNodesInRoot(payload.root, payload.nodes, payload.nodesKey);
      const out = shared.serializeKv3Text(payload.root);
      writeAnnotationFile(filePath, out);
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
);
electron.ipcMain.handle(
  "saveAsLocalGuide",
  async (_event, payload) => {
    try {
      const rootPath = getAnnotationsRootPath();
      const safeName = toLocalGuideName(payload.localName);
      if (!safeName) return { error: "Invalid guide name. Use letters, numbers, underscores or hyphens (no spaces)." };
      const dirPath = path.join(rootPath, safeName);
      const filePath = path.join(dirPath, `${safeName}.txt`);
      if (fs.existsSync(filePath)) return { error: `A local guide named "${safeName}" already exists.` };
      fs.mkdirSync(dirPath, { recursive: true });
      shared.setNodesInRoot(payload.root, payload.nodes, payload.nodesKey);
      const out = shared.serializeKv3Text(payload.root);
      writeAnnotationFile(filePath, out);
      return { path: filePath, loadName: safeName };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
);
electron.ipcMain.handle(
  "deleteGuide",
  async (_event, filePath) => {
    try {
      const annotationsRoot = store.get("annotationsRoot", "");
      if (!annotationsRoot) return { error: "Annotations folder not set." };
      const rootAbs = path.resolve(annotationsRoot);
      const fileAbs = path.resolve(filePath);
      const relative = path.relative(rootAbs, fileAbs);
      if (relative.startsWith("..") || path.isAbsolute(relative))
        return { error: "Can only delete local annotation files from the configured annotations folder." };
      if (!fs.existsSync(fileAbs)) return { error: "File not found." };
      fs.unlinkSync(fileAbs);
      const dirPath = path.dirname(fileAbs);
      if (fs.existsSync(dirPath)) {
        const remaining = fs.readdirSync(dirPath);
        if (remaining.length === 0) fs.rmdirSync(dirPath);
      }
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
);
electron.ipcMain.handle(
  "appendNodesToGuide",
  async (_event, payload) => {
    try {
      const { targetFilePath, nodes: newNodes } = payload;
      if (!fs.existsSync(targetFilePath))
        return { error: `File not found: ${targetFilePath}` };
      const bakPath = targetFilePath + ".bak";
      fs.copyFileSync(targetFilePath, bakPath);
      let raw = fs.readFileSync(targetFilePath, "utf-8");
      if (raw.charCodeAt(0) === 65279) raw = raw.slice(1);
      const root = shared.parseKv3Text(raw);
      const nodesKey = shared.extractNodesKey(root);
      const existingNodes = shared.kv3ToNodes(root, nodesKey);
      const merged = [...existingNodes, ...newNodes];
      shared.setNodesInRoot(root, merged, nodesKey);
      const out = shared.serializeKv3Text(root);
      writeAnnotationFile(targetFilePath, out);
      try {
        let written = fs.readFileSync(targetFilePath, "utf-8");
        if (written.charCodeAt(0) === 65279) written = written.slice(1);
        shared.parseKv3Text(written);
      } catch {
        fs.copyFileSync(bakPath, targetFilePath);
        return {
          error: "Copy failed: file could not be validated after write. The original file has been restored."
        };
      }
      fs.unlinkSync(bakPath);
      return { finalNodeCount: merged.length };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
);
electron.ipcMain.handle(
  "createGuideWithNodes",
  async (_event, payload) => {
    try {
      const rootPath = getAnnotationsRootPath();
      const safeName = toLocalGuideName(payload.filename);
      if (!safeName)
        return {
          error: "Invalid guide name. Use letters, numbers, underscores or hyphens."
        };
      const dirPath = path.join(rootPath, safeName);
      const filePath = path.join(dirPath, `${safeName}.txt`);
      if (fs.existsSync(filePath))
        return { error: `Guide "${safeName}" already exists.` };
      const dirCreatedByUs = !fs.existsSync(dirPath);
      fs.mkdirSync(dirPath, { recursive: true });
      const root = { MapName: payload.mapName, ScreenText: {}, Nodes: [] };
      shared.setNodesInRoot(root, payload.nodes, "Nodes");
      const out = shared.serializeKv3Text(root);
      writeAnnotationFile(filePath, out);
      try {
        let written = fs.readFileSync(filePath, "utf-8");
        if (written.charCodeAt(0) === 65279) written = written.slice(1);
        shared.parseKv3Text(written);
      } catch {
        try {
          fs.unlinkSync(filePath);
          if (dirCreatedByUs) fs.rmdirSync(dirPath);
        } catch {
        }
        return {
          error: "Create failed: file could not be validated after write."
        };
      }
      return { loadName: safeName, filePath };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
);
electron.ipcMain.on("watchGuideFile", (_event, filePath) => {
  if (currentFileWatcher) {
    currentFileWatcher.close();
    currentFileWatcher = null;
  }
  if (!filePath) return;
  const notify = debounce(() => {
    electron.BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("guideFileChanged", filePath));
  }, 400);
  try {
    currentFileWatcher = fs.watch(filePath, () => notify());
  } catch {
  }
});
electron.ipcMain.on("unwatchGuideFile", () => {
  if (currentFileWatcher) {
    currentFileWatcher.close();
    currentFileWatcher = null;
  }
});
const CS2_APP_ID = "730";
const CS2_WINDOW_TITLE = "Counter-Strike 2";
electron.ipcMain.handle("writeCS2Cfg", async (_event, command) => {
  try {
    const annotationsRoot = store.get("annotationsRoot", "");
    if (!annotationsRoot) return { error: "Annotations folder not configured in Settings." };
    const cfgDir = path.resolve(path.join(annotationsRoot, "../../cfg"));
    if (!fs.existsSync(cfgDir)) return { error: `CS2 cfg folder not found at: ${cfgDir}` };
    const cfgFile = path.join(cfgDir, "annotation_manager.cfg");
    fs.writeFileSync(cfgFile, command + "\n", "utf-8");
    electron.clipboard.writeText(command);
    return { cfgPath: cfgFile, content: command };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});
electron.ipcMain.handle("showItemInFolder", (_event, filePath) => {
  electron.shell.showItemInFolder(filePath);
});
electron.ipcMain.handle("launchCS2", async () => {
  try {
    await electron.shell.openExternal(`steam://run/${CS2_APP_ID}`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
});
electron.ipcMain.handle(
  "sendCS2ConsoleCommand",
  async (_event, command) => {
    if (process.platform !== "win32") {
      return { error: "Run in CS2 is only supported on Windows." };
    }
    try {
      const { Hardware } = require("keysender");
      const cs2 = new Hardware(CS2_WINDOW_TITLE);
      if (!cs2.workwindow.isOpen() && !cs2.workwindow.refresh()) {
        return { error: "Counter-Strike 2 window not found. Start the game first." };
      }
      await cs2.keyboard.sendKey("`", 80);
      await new Promise((r) => setTimeout(r, 100));
      await cs2.keyboard.printText(command, 30);
      await cs2.keyboard.sendKey("enter", 80);
      return {};
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "MODULE_NOT_FOUND") {
        return { error: 'Run in CS2 requires the "keysender" package (Windows). Install it with: npm install keysender. Then use Copy command and paste in the game console.' };
      }
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
);
