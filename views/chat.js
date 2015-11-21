"use strict";

let ipc = require("ipc");

const Message = React.createClass({
  render() {
    return React.DOM.div({className: "message message-" + (this.props.local ? "self" : "other")},
      React.DOM.span({className: "message-content"}, this.props.text),
      React.DOM.div({className: "message-misc"}, this.props.misc)
    );
  }
});

let userSteamId;
let userPersona;

ipc.on("user", (steamId, persona) => {
  userSteamId = steamId;
  userPersona = persona;

  ReactDOM.render(
    React.createElement(UserBlock, {persona}),
    document.getElementById("user-block"));

  document.title = persona.player_name + " - Chat";
});

function pushMessage(local, text) {
  let elem = document.createElement("div");
  /* elem.className = "message " + (side ? "message-self" : "message-other");

  let elem_msg = document.createElement("span");
  elem_msg.textContent = message;
  elem_msg.className = "message-content";
  elem.appendChild(elem_msg);

  // add time/date here */

  let misc = new Intl.DateTimeFormat(undefined, {
    month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric"}
  ).format(new Date());

  ReactDOM.render(React.createElement(Message, {local, text, misc}), elem);

  let shouldScroll = messages.scrollTop >= messages.scrollHeight - messages.clientHeight;
  messages.appendChild(elem);

  if (shouldScroll) {
    messages.scrollTop = messages.scrollHeight;
  }
}

ipc.on("message", message => {
  pushMessage(false, message);
});

new_message.addEventListener("keydown", event => {
  if (event.keyCode == 13 && !event.ctrlKey) {
    ipc.send("message", userSteamId, new_message.value);
    pushMessage(true, new_message.value);
    new_message.value = "";
    event.preventDefault();
  }
});

