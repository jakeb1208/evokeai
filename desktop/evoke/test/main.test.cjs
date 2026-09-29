"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

test("desktop window loads Evoke and keeps untrusted pages outside the app", async () => {
  const externalUrls = [];
  const permissions = {};
  let window;

  class FakeBrowserWindow {
    constructor(options) {
      this.options = options;
      this.webContents = new EventEmitter();
      this.webContents.getURL = () => this.url;
      this.webContents.setWindowOpenHandler = (handler) => {
        this.openHandler = handler;
      };
      window = this;
    }

    loadURL(url) {
      this.url = url;
      return Promise.resolve();
    }

    static getAllWindows() {
      return window ? [window] : [];
    }
  }

  const electron = {
    app: {
      requestSingleInstanceLock: () => true,
      whenReady: () => Promise.resolve(),
      setAppUserModelId: () => {},
      on: () => {},
    },
    BrowserWindow: FakeBrowserWindow,
    dialog: { showMessageBox: async () => ({ response: 1 }) },
    session: {
      defaultSession: {
        setPermissionRequestHandler: (handler) => { permissions.request = handler; },
        setPermissionCheckHandler: (handler) => { permissions.check = handler; },
      },
    },
    shell: { openExternal: async (url) => { externalUrls.push(url); } },
  };
  const appDirectory = path.join(__dirname, "..");
  const source = fs.readFileSync(path.join(appDirectory, "main.cjs"), "utf8");
  vm.runInNewContext(source, {
    URL,
    __dirname: appDirectory,
    require: (name) => name === "electron" ? electron : require(name),
  });
  await new Promise(setImmediate);

  assert.equal(window.url, "https://evokeai-production.up.railway.app/");
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  assert.equal(window.options.webPreferences.contextIsolation, true);
  assert.equal(window.options.webPreferences.sandbox, true);

  let granted;
  permissions.request(window.webContents, "pointerLock", (value) => { granted = value; });
  assert.equal(granted, true);
  permissions.request(window.webContents, "camera", (value) => { granted = value; });
  assert.equal(granted, false);
  assert.equal(permissions.check(window.webContents, "pointerLock", window.url), true);
  assert.equal(permissions.check(window.webContents, "pointerLock", "https://example.com/"), false);

  const blocked = { prevented: false, preventDefault() { this.prevented = true; } };
  window.webContents.emit("will-navigate", blocked, "https://example.com/");
  assert.equal(blocked.prevented, true);
  assert.deepEqual(externalUrls, ["https://example.com/"]);
  assert.equal(window.openHandler({ url: "javascript:alert(1)" }).action, "deny");
  assert.equal(externalUrls.length, 1);
  assert.equal(window.openHandler({ url: "https://evokeai-production.up.railway.app/immerse" }).action, "deny");
  assert.equal(window.url, "https://evokeai-production.up.railway.app/immerse");
});