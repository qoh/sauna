"use strict";

// function sendWhenLoaded(webContents, ...args) {
// Why does Node.js not have ...args yet?
module.exports.sendWhenLoaded = function(webContents) {
  const args = Array.from(arguments).slice(1);

  if (webContents.isLoading()) {
    webContents.once("did-finish-load", () => {
      // webContents.send(...args);
      // Seriously?
      webContents.send.apply(webContents, args);
    });
  } else {
    // webContents.send(...args);
    webContents.send.apply(webContents, args);
  }
};

module.exports.mapArrayToObject = (array, fn) => {
  let object = {};

  for (let value of array) {
    let result = fn(value);
    object[result[0]] = result[1];
  }

  return object;
};

module.exports.onceLoaded = (win, executor) => {
  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", executor);
  } else {
    executor();
  }
};

module.exports.onLoaded = (win, executor) => {
  if (win.webContents.isLoading()) {
    win.webContents.on("did-finish-load", executor);
  } else {
    executor();
  }
};
