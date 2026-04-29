"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const Store = require("electron-store");
const WHITESPACE = /[\s\n\r\t]/;
const DIGIT = /[0-9]/;
const IDENT_START = /[a-zA-Z_$]/;
const IDENT = /[a-zA-Z0-9_$]/;
function parseKv3Text(source) {
  let i = 0;
  const n = source.length;
  function skipWhitespaceAndComments() {
    while (i < n) {
      const c = source[i];
      if (WHITESPACE.test(c)) {
        i++;
        continue;
      }
      if (c === "/" && source[i + 1] === "/") {
        i += 2;
        while (i < n && source[i] !== "\n" && source[i] !== "\r") i++;
        continue;
      }
      if (c === "/" && source[i + 1] === "*") {
        i += 2;
        while (i < n - 1 && !(source[i] === "*" && source[i + 1] === "/")) i++;
        if (i < n - 1) i += 2;
        continue;
      }
      if (c === "<" && source.slice(i, i + 4) === "<!--") {
        i += 4;
        while (i < n - 2 && !(source[i] === "-" && source[i + 1] === "-" && source[i + 2] === ">")) i++;
        if (i < n - 2) i += 3;
        continue;
      }
      break;
    }
  }
  function readKey() {
    skipWhitespaceAndComments();
    if (i >= n) throw new Error("Unexpected end; expected key");
    const start = i;
    if (source[i] === '"') {
      i++;
      let key = "";
      while (i < n && source[i] !== '"') {
        if (source[i] === "\\") {
          i++;
          if (i < n) key += source[i];
          i++;
        } else {
          key += source[i++];
        }
      }
      if (i < n) i++;
      return key;
    }
    if (IDENT_START.test(source[i])) {
      while (i < n && IDENT.test(source[i])) i++;
      return source.slice(start, i);
    }
    throw new Error(`Unexpected character at ${i}; expected key`);
  }
  function expectEqual() {
    skipWhitespaceAndComments();
    if (source.slice(i, i + 1) === "=") {
      i++;
      return;
    }
    throw new Error(`Expected '=' at position ${i}`);
  }
  function readString() {
    skipWhitespaceAndComments();
    if (source[i] !== '"') throw new Error(`Expected string at ${i}`);
    i++;
    let s = "";
    while (i < n && source[i] !== '"') {
      if (source[i] === "\\") {
        i++;
        if (i < n) {
          const esc = source[i];
          if (esc === "n") s += "\n";
          else if (esc === "r") s += "\r";
          else if (esc === "t") s += "	";
          else if (esc === '"') s += '"';
          else s += esc;
          i++;
        }
      } else {
        s += source[i++];
      }
    }
    if (i < n) i++;
    return s;
  }
  function readNumber() {
    skipWhitespaceAndComments();
    const start = i;
    if (source[i] === "-") i++;
    while (i < n && DIGIT.test(source[i])) i++;
    if (i < n && source[i] === ".") {
      i++;
      while (i < n && DIGIT.test(source[i])) i++;
    }
    if (i < n && (source[i] === "e" || source[i] === "E")) {
      i++;
      if (source[i] === "+" || source[i] === "-") i++;
      while (i < n && DIGIT.test(source[i])) i++;
    }
    const num = source.slice(start, i);
    const v = parseFloat(num);
    if (Number.isNaN(v)) throw new Error(`Invalid number at ${start}`);
    return v;
  }
  function readValue() {
    skipWhitespaceAndComments();
    if (i >= n) throw new Error("Unexpected end; expected value");
    if (source[i] === "{") {
      i++;
      const obj = {};
      skipWhitespaceAndComments();
      while (i < n && source[i] !== "}") {
        const key = readKey();
        expectEqual();
        const val = readValue();
        obj[key] = val;
        skipWhitespaceAndComments();
        if (source[i] === ",") i++;
        skipWhitespaceAndComments();
      }
      if (i < n) i++;
      return obj;
    }
    if (source[i] === "[") {
      i++;
      const arr = [];
      skipWhitespaceAndComments();
      while (i < n && source[i] !== "]") {
        arr.push(readValue());
        skipWhitespaceAndComments();
        if (source[i] === ",") i++;
        skipWhitespaceAndComments();
      }
      if (i < n) i++;
      return arr;
    }
    if (source[i] === '"') return readString();
    if (source[i] === "-" || DIGIT.test(source[i])) return readNumber();
    const rest = source.slice(i);
    if (rest.startsWith("true")) {
      i += 4;
      return true;
    }
    if (rest.startsWith("false")) {
      i += 5;
      return false;
    }
    if (rest.startsWith("null")) {
      i += 4;
      return null;
    }
    throw new Error(`Unexpected character at ${i}: ${source[i]}`);
  }
  skipWhitespaceAndComments();
  if (i >= n) return {};
  if (source[i] === "{") {
    const root2 = readValue();
    skipWhitespaceAndComments();
    if (i < n) throw new Error(`Unexpected content at ${i}`);
    return root2;
  }
  const root = {};
  while (i < n) {
    skipWhitespaceAndComments();
    if (i >= n) break;
    const key = readKey();
    expectEqual();
    const val = readValue();
    root[key] = val;
    skipWhitespaceAndComments();
    if (source[i] === ",") i++;
  }
  return root;
}
const KV3_HEADER = "<!-- kv3 encoding:text:version{e21c7f3c-8a33-41c5-9977-a76d3a32aa0d} format:generic:version{7412167c-06e9-4698-aff2-e63eb59037e7} -->";
function escapeString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
}
function serializeValue(value, indent) {
  if (value === null) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return '"' + escapeString(value) + '"';
  if (Array.isArray(value)) {
    const arr = value;
    if (arr.length === 0) return "[]";
    const nextIndent2 = indent + "	";
    if (arr.some((v) => typeof v === "object" && v !== null && !Array.isArray(v))) {
      const items = arr.map((v) => nextIndent2 + serializeValue(v, nextIndent2));
      return "[\n" + items.join(",\n") + ",\n" + indent + "]";
    }
    return "[" + arr.map((v) => serializeValue(v, indent)).join(", ") + "]";
  }
  const obj = value;
  const keys = Object.keys(obj);
  if (keys.length === 0) return "{}";
  const nextIndent = indent + "	";
  const lines = keys.map((key) => {
    const keyStr = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? key : '"' + escapeString(key) + '"';
    return nextIndent + keyStr + " = " + serializeValue(obj[key], nextIndent);
  });
  return "{\n" + lines.join("\n") + "\n" + indent + "}";
}
function serializeKv3Text(value) {
  return KV3_HEADER + "\n" + serializeValue(value, "");
}
function isKv3Object(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isKv3Array(v) {
  return Array.isArray(v);
}
const DEFAULT_NODES_KEY = "Nodes";
function getFloatArray(v) {
  if (!Array.isArray(v) || v.length < 3) return void 0;
  const a = v;
  const x = Number(a[0]);
  const y = Number(a[1]);
  const z = Number(a[2]);
  if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) return void 0;
  return [x, y, z];
}
function getTextDesc(v) {
  if (!isKv3Object(v)) return void 0;
  const o = v;
  const text = typeof o.Text === "string" ? o.Text : "";
  const fontSize = typeof o.FontSize === "number" ? o.FontSize : 14;
  const fadeIn = typeof o.FadeInDist === "number" ? o.FadeInDist : -1;
  const fadeOut = typeof o.FadeOutDist === "number" ? o.FadeOutDist : -1;
  const showBg = typeof o.ShowBackground === "boolean" ? o.ShowBackground : true;
  return { Text: text, FontSize: fontSize, FadeInDist: fadeIn, FadeOutDist: fadeOut, ShowBackground: showBg };
}
const KNOWN_NODE_FIELDS = /* @__PURE__ */ new Set([
  "Type",
  "SubType",
  "Id",
  "Position",
  "Angles",
  "Enabled",
  "VisiblePfx",
  "Color",
  "TextPositionOffset",
  "TextFacePlayer",
  "TextHorizontalAlign",
  "Title",
  "Desc",
  "MasterNodeId",
  "RevealOnSuccess",
  "StreakLimitGuidesOn",
  "StreakLimitGuidesOff",
  "JumpThrow",
  "GrenadeType"
]);
function kv3ToNode(obj) {
  const type = typeof obj.Type === "string" ? obj.Type : "position";
  const node = {
    Type: type,
    SubType: typeof obj.SubType === "string" ? obj.SubType : "main"
  };
  if (typeof obj.Id === "string") node.Id = obj.Id;
  const pos = getFloatArray(obj.Position);
  if (pos) node.Position = pos;
  const angles = getFloatArray(obj.Angles);
  if (angles) node.Angles = angles;
  if (typeof obj.Enabled === "boolean") node.Enabled = obj.Enabled;
  if (typeof obj.VisiblePfx === "boolean") node.VisiblePfx = obj.VisiblePfx;
  const color = getFloatArray(obj.Color);
  if (color) node.Color = color.map((c) => Math.max(0, Math.min(255, c)));
  const textOffset = getFloatArray(obj.TextPositionOffset);
  if (textOffset) node.TextPositionOffset = textOffset;
  if (typeof obj.TextFacePlayer === "boolean") node.TextFacePlayer = obj.TextFacePlayer;
  if (typeof obj.TextHorizontalAlign === "string") node.TextHorizontalAlign = obj.TextHorizontalAlign;
  const title = getTextDesc(obj.Title);
  if (title) node.Title = title;
  const desc = getTextDesc(obj.Desc);
  if (desc) node.Desc = desc;
  if (typeof obj.MasterNodeId === "string") node.MasterNodeId = obj.MasterNodeId;
  if (typeof obj.RevealOnSuccess === "boolean") node.RevealOnSuccess = obj.RevealOnSuccess;
  if (typeof obj.StreakLimitGuidesOn === "number") node.StreakLimitGuidesOn = obj.StreakLimitGuidesOn;
  if (typeof obj.StreakLimitGuidesOff === "number") node.StreakLimitGuidesOff = obj.StreakLimitGuidesOff;
  if (typeof obj.JumpThrow === "boolean") node.JumpThrow = obj.JumpThrow;
  if (typeof obj.GrenadeType === "string") node.GrenadeType = obj.GrenadeType;
  const extra = {};
  for (const key of Object.keys(obj)) {
    if (!KNOWN_NODE_FIELDS.has(key)) extra[key] = obj[key];
  }
  if (Object.keys(extra).length > 0) node._extra = extra;
  return node;
}
function nodeToKv3Object(node) {
  const o = {
    Type: node.Type,
    SubType: node.SubType ?? "main"
  };
  if (node.Id) o.Id = node.Id;
  if (node.Position) o.Position = node.Position;
  if (node.Angles) o.Angles = node.Angles;
  if (node.Enabled !== void 0) o.Enabled = node.Enabled;
  if (node.VisiblePfx !== void 0) o.VisiblePfx = node.VisiblePfx;
  if (node.Color) o.Color = node.Color;
  if (node.TextPositionOffset) o.TextPositionOffset = node.TextPositionOffset;
  if (node.TextFacePlayer !== void 0) o.TextFacePlayer = node.TextFacePlayer;
  if (node.TextHorizontalAlign !== void 0) o.TextHorizontalAlign = node.TextHorizontalAlign;
  if (node.Title) o.Title = node.Title;
  if (node.Desc) o.Desc = node.Desc;
  if (node.MasterNodeId) o.MasterNodeId = node.MasterNodeId;
  if (node.RevealOnSuccess !== void 0) o.RevealOnSuccess = node.RevealOnSuccess;
  if (node.StreakLimitGuidesOn !== void 0) o.StreakLimitGuidesOn = node.StreakLimitGuidesOn;
  if (node.StreakLimitGuidesOff !== void 0) o.StreakLimitGuidesOff = node.StreakLimitGuidesOff;
  if (node.JumpThrow !== void 0) o.JumpThrow = node.JumpThrow;
  if (node.GrenadeType) o.GrenadeType = node.GrenadeType;
  if (node._extra) Object.assign(o, node._extra);
  return o;
}
function kv3ToNodes(root, nodesKey = DEFAULT_NODES_KEY) {
  if (!isKv3Object(root)) return [];
  const obj = root;
  const nodesVal = obj[nodesKey];
  if (isKv3Array(nodesVal)) {
    return nodesVal.map((item) => {
      if (!isKv3Object(item)) return null;
      return kv3ToNode(item);
    }).filter((n) => n !== null);
  }
  const nodes = [];
  for (const [, value] of Object.entries(obj)) {
    if (!isKv3Object(value)) continue;
    const v = value;
    if (typeof v.Type === "string") {
      nodes.push(kv3ToNode(v));
    }
  }
  return nodes;
}
function extractNodesKey(root) {
  if (root.Nodes !== void 0 && Array.isArray(root.Nodes)) return "Nodes";
  if (root.nodes !== void 0 && Array.isArray(root.nodes)) return "nodes";
  for (const k of Object.keys(root)) {
    if (Array.isArray(root[k])) return k;
  }
  return DEFAULT_NODES_KEY;
}
function setNodesInRoot(root, nodes, nodesKey) {
  const current = root[nodesKey];
  if (isKv3Array(current) || Array.isArray(current)) {
    const arr = nodes.map((n) => nodeToKv3Object(n));
    root[nodesKey] = arr;
    return;
  }
  const mapKeys = Object.keys(root).filter((k) => k.startsWith("MapAnnotationNode"));
  for (const k of mapKeys) {
    delete root[k];
  }
  nodes.forEach((node, index) => {
    const key = `MapAnnotationNode${index}`;
    root[key] = nodeToKv3Object(node);
  });
}
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
      const root = parseKv3Text(raw);
      const nodesKey = extractNodesKey(root);
      const nodes = kv3ToNodes(root, nodesKey);
      if (!hadBom || !hasKv3Header) {
        writeAnnotationFile(filePath, serializeKv3Text(root));
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
      const out = serializeKv3Text(root);
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
      setNodesInRoot(payload.root, payload.nodes, payload.nodesKey);
      const out = serializeKv3Text(payload.root);
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
      setNodesInRoot(payload.root, payload.nodes, payload.nodesKey);
      const out = serializeKv3Text(payload.root);
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
