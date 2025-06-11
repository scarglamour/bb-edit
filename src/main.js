require("@electron/remote/main").initialize();

const { app, BrowserWindow } = require("electron");
const path = require("path");
const url = require("url");
const fs = require("fs");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    width: 1050,
    height: 820,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });
  win.setMenuBarVisibility(false);

  require("@electron/remote/main").enable(win.webContents);

  // and load the index.html of the app.
  win.loadURL(
    url.format({
      pathname: path.join(__dirname, "renderer", "index.html"),
      protocol: "file:",
      slashes: true,
    })
  );

  // show DEBUG
  win.webContents.openDevTools({ mode: "bottom" });

  // Emitted when the window is closed.
  win.on("closed", () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  app.quit();
});
