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

const sectionWait = document.getElementById("section-wait");
const sectionLogin = document.getElementById("section-login");
const sectionSentry = document.getElementById("section-sentry");

let visibleSection = sectionWait;

function switchSection(section) {
  visibleSection.classList.add("disabled");
  section.classList.remove("disabled");
  visibleSection = section;
  // TODO: Focus the `autofocus` field here!
}

ipc.on("login", event => {
  switchSection(sectionLogin);
});

ipc.on("error", (event, result, message) => {
  switchSection(sectionLogin);

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

  switchSection(sectionSentry);
  input_sentry.focus();
});

sectionLogin.addEventListener("submit", event => {
  event.preventDefault();

  ipc.send("login", {
    accountName: input_username.value,
    password: input_password.value,
    rememberPassword: input_remember.value
  });

  switchSection(sectionWait);
});

sectionSentry.addEventListener("submit", event => {
  event.preventDefault();

  ipc.send("login:sentry", input_sentry.value);

  switchSection(sectionWait);
});
