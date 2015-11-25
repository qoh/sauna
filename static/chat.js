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

let selfTypingState = false;
let selfTypingTimeout;

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
      React.DOM.div({className: "message-sender"}, this.props.senderName),
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

      // ipc.send("notify", {
      //   title: `${userPersona.player_name} said`,
      //   body: options.text,
      //   image: userPersona.avatar_url_full,
      //   clickSend: ["friends:chat", userSteamID]
      // });
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

// ipc.on("message", (event, steamID, text) => {
ipc.on("message", (event, data) => {
  // addMessage({
  //   isSelf: steamID === null,
  //   isEcho: steamID === null,
  //   sender: steamID === null ? "wats my name" : userPersona.player_name,
  //   text
  // });

  addMessage(data);

  if (!data.isSelf) {
    user_info.textContent = "";
    clearTimeout(typingTimeout);
  }
});

ipc.on("typing", event => {
  clearTimeout(typingTimeout);
  setTimeout(() => user_info.textContent = "", 15000);
  user_info.textContent = `${userPersona.player_name} is typing a message...`;
});

function sendMessage(message) {
  ipc.send("chat:message", userSteamID, message);
  // addMessage({
  //   isSelf: true,
  //   sender: "wats my name",
  //   text: message
  // });
}

// This should probably be moved somewhere else
function insertText(elem, text) {
  let scroll = elem.scrollTop;
  let end = elem.selectionStart + text.length;

  let head = elem.value.substring(0, elem.selectionStart);
  let tail = elem.value.substring(elem.selectionEnd, elem.value.length);

  elem.value = head + text + tail;
  elem.focus();
  elem.setSelectionRange(end, end);

  // Scrolling to cursor isn't working.
  // Workaround: Scroll to the bottom if cursor is at bottom.
  // Covers most cases of inserting a character.
  if (elem.selectionEnd === elem.value.length) {
    elem.scrollTop = elem.scrollHeight;
  }
}

new_message.addEventListener("keydown", (event) => {
  if (event.keyCode == 13) {
    event.preventDefault();

    if (event.ctrlKey) {
      insertText(new_message, "\n");
    } else {
      if (new_message.value.trim().length > 0) {
        if (selfTypingState) {
          selfTypingState = false;
          clearTimeout(selfTypingState);
        }

        sendMessage(new_message.value);
        new_message.value = "";
      }

      return;
    }
  }

  if (!selfTypingState) {
    ipc.send("chat:typing", userSteamID);

    selfTypingState = true;
    selfTypingTimeout = setTimeout(() => selfTypingState = false, 15000);
  }
});

user_dropdown.addEventListener("click", (event) => {
  event.preventDefault();
  ipc.send("request-trade", userSteamID);
});

// This hack is necessary because the window.resize event happens after the
// resize and does not provide any access to the old size.
let oldWindowHeight;

document.addEventListener("DOMContentLoaded", event => {
  oldWindowHeight = window.innerHeight;
});

// Maintain scroll position relative to bottom of scroll region
window.addEventListener("resize", (event) => {
  let oldHeight = oldWindowHeight;
  let newHeight = window.innerHeight;
  oldWindowHeight = newHeight;

  let deltaHeight = oldHeight - newHeight;
  let deltaScroll = messages.scrollHeight - messages.clientHeight - messages.scrollTop;

  // Trying to stick to the bottom when the window size increases seems to
  // cause a miniscule offset. Just don't do anything when it increases and
  // at the bottom. Same behavior regardless.
  if (deltaHeight < 0 && deltaScroll == 0) {
    return;
  }

  messages.scrollTop += deltaHeight;
});
