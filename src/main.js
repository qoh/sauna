/*jshint node: true */
/*jshint esnext: true */
"use strict";

if (process.env.DEBUG) {
  require("electron-debug")();
}

const electron = require("electron");
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

const app = electron.app;
const yargs = require("yargs");
const SaunaApp = require("./SaunaApp.js");

function parseOptions(commandLine) {
  return yargs
    .usage("Usage: $o [options]")
    .boolean("new-instance")
    .describe("new-instance", "Start a new instance even when running")
    .boolean("tray")
    .default("tray", true)
    .describe("tray", "Run in the background and close to tray")
    .help("h")
    .alias("h", "help")
    .parse(commandLine);
}

let options = parseOptions(process.argv);

if (!options["new-instance"]) {
  let shouldQuit = app.makeSingleInstance((commandLine, workingDirectory) => {
    let newOptions = parseOptions(commandLine);

    if (global.sauna) {
      global.sauna.receiveOptions(newOptions, workingDirectory);
    }

    return true;
  });

  if (shouldQuit) {
    app.quit();
    return;
  }
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
  const app = new SaunaApp(options);
  global.sauna = app;
});
