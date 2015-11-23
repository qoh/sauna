"use strict";

const electron = require("electron");
const app = electron.app;
const dialog = electron.dialog;

// Install a basic error handler that can be used before the app.ready event
let handleError = error => {
  dialog.showErrorBox("A JavaScript error has occurred in the main process",
    error.stack.toString());
  process.exit(1); // Just exit immediately
};

process.on("uncaughtException", error => {
  console.log("Exception occurred in main process");
  console.log(error.stack);

  try {
    handleError(error);
  } catch (second) {
    console.log("\nException occurred while handling exception");
    console.log("New exception:", second.stack);

    process.exit(1);
  }
});

const SaunaApp = require("./SaunaApp.js");

let shouldQuit = app.makeSingleInstance((commandLine, workingDirectory) => {
  // if (myWindow) {
  //   if (myWindow.isMinimized()) myWindow.restore();
  //   myWindow.focus();
  // }

  return true;
});

if (shouldQuit) {
  // app.quit();
  // return;
}

app.on("ready", () => {
  // Now that the app is ready, install a more user-friendly error handler
  // which will prompt the user for the appropriate action
  handleError = error => {
    dialog.showMessageBox({
      type: "error",
      buttons: ["Continue", "Exit"],
      title: "Error",
      message: "A JavaScript error has occurred in the main process",
      detail: error.stack.toString()
    }, response => {
      if (response == 1) {
        process.exit(1);
      }
    });
  };

  // Create an instance of the singleton app, which will take things from here
  const app = new SaunaApp();
  global.saunaApp = app;
});
