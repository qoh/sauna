"use strict";

let ipc = require("ipc");

const FriendsList = React.createClass({
  getPersona(steamId) {
    return this.props.users[steamId] || {
      player_name: "",
      persona_state: 0
    };
  },

  render() {
    return React.DOM.div(null,
      this.props.friends
        .map(steamId => ({steamId, persona: this.getPersona(steamId)}))
        // .filter(entry => entry.persona.persona_state)
        .sort((a, b) => {
          let ord_a = getPersonaOrder(a.persona);
          let ord_b = getPersonaOrder(b.persona);

          if (ord_a == ord_b) {
            return a.persona.player_name.localeCompare(b.persona.player_name);
          } else {
            // return ord_a < ord_b ? -1 : 1;
            return ord_a - ord_b;
          }
        })
        .map(entry => React.createElement(UserBlock, {
          key: entry.steamId, persona: entry.persona,
          onClick: () => ipc.send("chat", entry.steamId)
      }))
    );
  }
});

let knownUsers = {};
let myFriends = {};

function updateDisplay() {
  ReactDOM.render(
    React.createElement(FriendsList, {friends: myFriends, users: knownUsers}),
    friends);
}

/* ipc.on("users", users => {
  for (let steamId of Object.keys(users)) {
    knownUsers[steamId] = users[steamId];
  }

  updateDisplay();
}); */

ipc.on("friends", list => {
  myFriends = Object.keys(list);
  updateDisplay();
});

ipc.on("user", (steam_id, data) => {
  console.log(data);
  knownUsers[steam_id] = data;
  updateDisplay();
});

