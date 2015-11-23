"use strict";

const React = require("react");
const ReactDOM = require("react-dom");

const UserBlock = require("../src/client/UserBlock.js");

const electron = require("electron");
const ipc = electron.ipcRenderer;
const remote = electron.remote;

const Steam = remote.getGlobal("Steam");

let userSteamID, userPersona;

class Message extends React.Component {
  render() {
    let className = `message message-${this.props.isSelf ? "self" : "other"}`;

    let timestamp = new Intl.DateTimeFormat(undefined, {
      hour: "numeric", minute: "numeric", second: "numeric"
    }).format(this.props.date);

    return React.DOM.div({className: className},
      React.DOM.div({className: "message-content"}, this.props.text),
      React.DOM.div({className: "message-extra"}, timestamp)
    );
  }
}

function addMessage(isSelf, text, date) {
  let container = document.createElement("div");
  ReactDOM.render(React.createElement(Message, {isSelf, text, date}), container);

  let shouldScroll =
    messages.scrollTop >= messages.scrollHeight - messages.clientHeight;

  messages.appendChild(container);

  if (shouldScroll) {
    messages.scrollTop = messages.scrollHeight;
  }
}

ipc.on("user", (event, steamID, persona) => {
  userSteamID = steamID;
  userPersona = persona;

  document.title = `${persona.player_name} - Chat`;

  ReactDOM.render(React.createElement(UserBlock, {
    steamID: steamID,
    persona: persona
  }), user_container);
});

ipc.on("message", (event, steamID, text) => {
  addMessage(false, text, new Date());
});

new_message.addEventListener("keydown", (event) => {
  if (event.keyCode == 13) {
    event.preventDefault();
    ipc.send("chat:message", userSteamID, new_message.value);
    addMessage(true, new_message.value, new Date());
    new_message.value = "";
  }
});
