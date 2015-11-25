/*jshint node: true */
/*jslint browser:true */
/*jshint esnext: true */

"use strict";

const marked = require("marked");
const React = require("react");
const ReactDOM = require("react-dom");

const UserBlock = require("../src/client/UserBlock.js");

const electron = require("electron");
const ipc = electron.ipcRenderer;

const messages = document.getElementById("messages");
const user_container = document.getElementById("user_container");
const user_info = document.getElementById("user_info");
const user_dropdown = document.getElementById("user_dropdown");
const new_message = document.getElementById("new_message");

const userSteamID = document.location.hash.substr(1);
let userPersona;

const renderer = new marked.Renderer();

// renderer.paragraph = text => {
//   console.log(text);
//   return `<span>${text}</span>`;
// };

// markedRenderer.link = (href, title, text) => {
//   // maybe embed images here?
// };

function flashFrame(active) {
  try {
    electron.remote.getCurrentWindow().flashFrame(active);
  } catch (error) {
    console.log("it is a mystery");
    console.log(error);
  }
}

class Message extends React.Component {
  renderMessage(text) {
    let atoms = [];
    let index = 0;

    function find(what) {
      let where = text.indexOf(what, index);

      if (where == -1) {
        return index.length;
      }

      return where;
    }

    while (index < text.length) {
      let nextLineBreak = find("\n");
      let nextHttp = find("http");

      let next = Math.min(
        find("\n"),
        find("http")
      );
    }

    return atoms;
  }

  render() {
    let text = this.props.text;
    let className = `message message-${this.props.isSelf ? "self" : "other"}`;

    if (this.props.isEcho) {
      className += " message-echo";
    } else if (text.startsWith("/me ")) {
      text = text.substr(4);
      className += " message-action";
    }

    let html = marked(text, {
      renderer,
      breaks: true,
      sanitize: true
    });

    let timestamp = new Intl.DateTimeFormat(undefined, {
      hour: "numeric", minute: "numeric", second: "numeric"
    }).format(this.props.date);

    return React.DOM.div({className: className},
      React.DOM.div({className: "message-timestamp"}, timestamp),
      React.DOM.div({className: "message-sender"}, this.props.sender),
      React.DOM.div({
        className: "message-text",
        dangerouslySetInnerHTML: {__html: html}
      })
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
    if (!document.hasFocus()) {
      flashFrame(true);

      let sound = new Audio("sounds/chime_bell_ding.wav");
      sound.play();

      ipc.send("notify", {
        title: `${userPersona.player_name} said`,
        body: options.text,
        image: userPersona.avatar_url_full,
        clickSend: ["friends:chat", userSteamID]
      });
    } else {
      let sound = new Audio("sounds/digi_plink.wav");
      sound.play();
    }
  }
}

window.addEventListener("focus", () => {
  flashFrame(false);
});

ipc.on("user", (event, steamID, persona) => {
  if (steamID !== userSteamID) {
    console.log("ignoring persona for", steamID);
    return;
  }

  userPersona = persona;

  document.title = `${persona.player_name} - Chat`;

  ReactDOM.render(
    React.createElement(UserBlock, {steamID, persona}),
    user_container);
});

let typingTimeout;

ipc.on("message", (event, steamID, text) => {
  addMessage({
    isSelf: steamID === null,
    isEcho: steamID === null,
    sender: steamID === null ? "wats my name" : userPersona.player_name,
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
      if(new_message.value.trim().length > 0) {
        ipc.send("chat:message", userSteamID, new_message.value);
        addMessage({
          isSelf: true,
          sender: "wats my name",
          text: new_message.value
        });

        new_message.value = "";
      }
    }
  } else {
    ipc.send("chat:typing", userSteamID);
  }
});

user_dropdown.addEventListener("click", (event) => {
  event.preventDefault();
  ipc.send("request-trade", userSteamID);
});
