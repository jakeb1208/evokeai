"use strict";

const path = require("node:path");
const { app, BrowserWindow, dialog, session, shell } = require("electron");

const EVOKE_URL = "https://evokeai-production.up.railway.app/";
const EVOKE_ORIGIN = new URL(EVOKE_URL).origin;

function isEvokeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === EVOKE_ORIGIN;
  } catch {
    return false;
  }
}

function openInBrowser(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "mailto:") {
      void shell.openExternal(url.href);
    }
  } catch {
    // Reject malformed navigation targets.
  }
}

function createWindow() {
  const window = new BrowserWindow({
    title: "Evoke AI",
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#e7f2d3",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isEvokeUrl(url)) {
      void window.loadURL(url);
    } else {
      openInBrowser(url);
    }
    return { action: "deny" };
  });

  const keepNavigationOnEvoke = (event, url) => {
    if (!isEvokeUrl(url)) {
      event.preventDefault();
      openInBrowser(url);
    }
  };
  window.webContents.on("will-navigate", keepNavigationOnEvoke);
  window.webContents.on("will-redirect", keepNavigationOnEvoke);

  let showingConnectionError = false;
  window.webContents.on("did-fail-load", (_event, code, _description, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || !isEvokeUrl(url) || showingConnectionError) return;
    showingConnectionError = true;
    void dialog.showMessageBox(window, {
      type: "error",
      title: "Evoke AI is unavailable",
      message: "Could not connect to Evoke AI.",
      detail: "Check your internet connection and try again. Your saved worlds remain in your account.",
      buttons: ["Retry", "Close"],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      showingConnectionError = false;
      if (response === 0 && !window.isDestroyed()) {
        void window.loadURL(EVOKE_URL).catch(() => {});
      } else if (!window.isDestroyed()) {
        window.close();
      }
    });
  });

  void window.loadURL(EVOKE_URL).catch(() => {});
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId("ai.evoke.desktop");
    session.defaultSession.setPermissionRequestHandler((webContents, permission, respond) => {
      respond(permission === "pointerLock" && isEvokeUrl(webContents?.getURL() ?? ""));
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) =>
      permission === "pointerLock" &&
      isEvokeUrl(requestingOrigin || webContents?.getURL() || "")
    );
    createWindow();
  });

  app.on("window-all-closed", () => app.quit());
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}