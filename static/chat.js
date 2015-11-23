/*jshint node: true */
/*jshint esnext: true */

"use strict";

const React = require("react");
const ReactDOM = require("react-dom");

const UserBlock = require("../src/client/UserBlock.js");

const electron = require("electron");
const ipc = electron.ipcRenderer;
const remote = electron.remote;

const win = remote.getCurrentWindow();
const Steam = remote.getGlobal("Steam");
const saunaApp = remote.getGlobal("saunaApp");

let userSteamID, userPersona;

class Message extends React.Component {
  render() {
    let className = `message message-${this.props.isSelf ? "self" : "other"}`;

    if (this.props.isEcho) {
        className += " message-echo";
    }

    let timestamp = new Intl.DateTimeFormat(undefined, {
      hour: "numeric", minute: "numeric", second: "numeric"
    }).format(this.props.date);

    return React.DOM.div({className: className},
      React.DOM.div({className: "message-content"}, this.props.text),
      React.DOM.div({className: "message-extra"}, timestamp)
    );
  }
}

function addMessage(options) {
  options.date = options.date || new Date();

  let container = document.createElement("div");
  ReactDOM.render(React.createElement(Message, options), container);

  let shouldScroll =
    messages.scrollTop >= messages.scrollHeight - messages.clientHeight;

  messages.appendChild(container);

  if (shouldScroll) {
    messages.scrollTop = messages.scrollHeight;
  }

  if (!options.isSelf) {
    if (!win.isFocused()) {
      win.flashFrame(true);

      let sound = new Audio("sounds/chime_bell_ding.wav");
      sound.play();
    } else {
      let sound = new Audio("sounds/digi_plink.wav");
      sound.play();
    }
  }
}

win.on("focus", () => {
  win.flashFrame(false);
});

ipc.on("user", (event, steamID, persona) => {
  userSteamID = steamID;
  userPersona = persona;

  document.title = `${persona.player_name} - Chat`;

  ReactDOM.render(React.createElement(UserBlock, {
    steamID: steamID,
    persona: persona
  }), user_container);
});

let typingTimeout;

ipc.on("message", (event, steamID, text) => {
  addMessage({
    isSelf: steamID === null,
    isEcho: steamID === null,
    text
  });

  user_info.textContent = "";
  clearTimeout(typingTimeout);
});

ipc.on("typing", event => {
  clearTimeout(typingTimeout);
  setTimeout(() => user_info.textContent = "", 15000);
  user_info.textContent = "Friend is typing a message...";
});

new_message.addEventListener("keydown", (event) => {
  if (event.keyCode == 13) {
    event.preventDefault();

    if (event.ctrlKey) {
      // TODO: add at cursor
      new_message.value += "\n";
    } else {
      ipc.send("chat:message", userSteamID, new_message.value);
      addMessage({
        isSelf: true,
        text: new_message.value
      });

      new_message.value = "";
    }
  } else {
    ipc.send("chat:typing", userSteamID);
  }
});

user_dropdown.addEventListener("click", (event) => {
  event.preventDefault();
  saunaApp.user.trade(userSteamID);
});
