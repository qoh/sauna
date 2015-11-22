"use strict";

const ipc = require("electron").ipcRenderer;

ipc.on("sentry", domain => {
  sentry.classList.add("visible");
  sentrycode.disabled = false;
  sentrycode.focus();
});

container.addEventListener("submit", event => {
  event.preventDefault();

  if (sentry.classList.contains("visible")) {
    console.log("sending sentry code", sentrycode.value);
    ipc.send("sentry", sentrycode.value);
    sentrycode.disabled = true;
    return false;
  }

  console.log("sending login");
  ipc.send("login", {
    accountName: username.value,
    password: password.value,
    rememberPassword: remember.value,
  });

  username.disabled = true;
  password.disabled = true;
  remember.disabled = true;

  return false;
});
