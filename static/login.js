"use strict";

const electron = require("electron");
const ipc = electron.ipcRenderer;
const remote = electron.remote;

const Steam = remote.getGlobal("Steam");

const FailMessage = {
  [Steam.EResult.NoConnection]: "Cannot connect to Steam",
  [Steam.EResult.InvalidPassword]: "Invalid username/password combination",
  [Steam.EResult.LoggedInElsewhere]: "This account is logged in elsewhere",
  [Steam.EResult.Timeout]: "Connection timeout",
  [Steam.EResult.Banned]: "You are banned",
  [Steam.EResult.ServiceUnavailable]: "Steam service is unavailable"
};

ipc.on("error", (event, result, message) => {
  section_main.classList.remove("disabled");
  section_wait.classList.add("disabled");

  let text;

  if (FailMessage[result] !== undefined) {
    text = FailMessage[result];
  } else {
    text = `Error: ${message}`;
  }

  error_text.textContent = text;
  error_text.style.display = "block";

  input_username.focus();
});

ipc.on("sentry", (event, domain) => {
  sentry_source.textContent =
    `This account is protected by Steam Guard.
    Please enter the code from your ${
      domain === null
        ? "mobile authenticator"
        : `e-mail ending in ${domain.toString()}`
    }.`;

  section_sentry.classList.remove("disabled");
  section_wait.classList.add("disabled");

  input_sentry.focus();
});

section_main.addEventListener("submit", event => {
  event.preventDefault();

  ipc.send("login", {
    accountName: input_username.value,
    password: input_password.value,
    rememberPassword: input_remember.value
  });

  section_main.classList.add("disabled");
  section_wait.classList.remove("disabled");
});

section_sentry.addEventListener("submit", event => {
  event.preventDefault();

  ipc.send("login:sentry", input_sentry.value);

  section_sentry.classList.add("disabled");
  section_wait.classList.remove("disabled");
});

section_main.classList.remove("disabled");
