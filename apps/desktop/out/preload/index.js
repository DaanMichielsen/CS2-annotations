"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  getAnnotationsRoot: () => electron.ipcRenderer.invoke("getAnnotationsRoot"),
  setAnnotationsRoot: (root) => electron.ipcRenderer.invoke("setAnnotationsRoot", root),
  getWorkshopContentPath: () => electron.ipcRenderer.invoke("getWorkshopContentPath"),
  setWorkshopContentPath: (p) => electron.ipcRenderer.invoke("setWorkshopContentPath", p),
  getAutoCopyLoadCommandsOnOpen: () => electron.ipcRenderer.invoke("getAutoCopyLoadCommandsOnOpen"),
  setAutoCopyLoadCommandsOnOpen: (value) => electron.ipcRenderer.invoke("setAutoCopyLoadCommandsOnOpen", value),
  detectSteamPath: () => electron.ipcRenderer.invoke("detectSteamPath"),
  listGuides: () => electron.ipcRenderer.invoke("listGuides"),
  loadGuide: (filePath) => electron.ipcRenderer.invoke("loadGuide", filePath),
  createGuide: (filename, mapName) => electron.ipcRenderer.invoke("createGuide", filename, mapName),
  saveGuide: (payload) => electron.ipcRenderer.invoke("saveGuide", payload),
  saveAsLocalGuide: (payload) => electron.ipcRenderer.invoke("saveAsLocalGuide", payload),
  deleteGuide: (filePath) => electron.ipcRenderer.invoke("deleteGuide", filePath),
  appendNodesToGuide: (payload) => electron.ipcRenderer.invoke("appendNodesToGuide", payload),
  createGuideWithNodes: (payload) => electron.ipcRenderer.invoke("createGuideWithNodes", payload),
  sendCS2ConsoleCommand: (command) => electron.ipcRenderer.invoke("sendCS2ConsoleCommand", command),
  writeCS2Cfg: (command) => electron.ipcRenderer.invoke("writeCS2Cfg", command),
  showItemInFolder: (filePath) => electron.ipcRenderer.invoke("showItemInFolder", filePath),
  launchCS2: () => electron.ipcRenderer.invoke("launchCS2"),
  watchGuideFile: (filePath) => electron.ipcRenderer.send("watchGuideFile", filePath),
  unwatchGuideFile: () => electron.ipcRenderer.send("unwatchGuideFile"),
  onGuideFileChanged: (callback) => {
    const handler = (_, fp) => callback(fp);
    electron.ipcRenderer.on("guideFileChanged", handler);
    return () => electron.ipcRenderer.removeListener("guideFileChanged", handler);
  }
});
