"use strict";

const React = require("react");
const ReactDOM = require("react-dom");

const FriendsList = require("../src/client/FriendsList.js");

const electron = require("electron");
const ipc = electron.ipcRenderer;
const remote = electron.remote;

const Steam = remote.getGlobal("Steam");

// ipc.on("sentry", (event, domain) => {
//   sentry_source.textContent =
//     `This account is protected by Steam Guard.
//     Please enter the code from your ${
//       domain === null
//         ? "mobile authenticator"
//         : `e-mail ending in ${domain.toString()}`
//     }.`;
//
//   section_sentry.classList.remove("disabled");
//   section_wait.classList.add("disabled");
//
//   input_sentry.focus();
// });

let friendList = {};
let friendGroupList = [];
let knownPersonas = {};

function mount() {
  ReactDOM.render(React.createElement(FriendsList, {
    friends: friendList,
    friendGroups: friendGroupList,
    personas: knownPersonas
  }), container);
}

ipc.on("friends", (event, list) => {
  console.log("friends", list);
  friendList = list;
  mount();
});

ipc.on("friend-groups", (event, list) => {
  console.log("friend-groups", list);
  friendGroupList = list;
  mount();
});

ipc.on("personas", (event, list) => {
  console.log("personas", list);
  Object.assign(knownPersonas, list);
  mount();
});
