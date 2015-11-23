"use strict";

const React = require("react");
const electron = require("electron");
const ipc = electron.ipcRenderer;
const remote = electron.remote;
const Steam = remote.getGlobal("Steam");
const UserBlock = require("./UserBlock.js");

class FriendsList extends React.Component {
  getPersonaOrder(persona) {
    if (persona.game_name) {
      return 0;
    } else if (persona.persona_state === Steam.EPersonaState.Online) {
      return 1;
    } else if (
      persona.persona_state === Steam.EPersonaState.Offline ||
      persona.persona_state === null
    ) {
      return 3;
    } else {
      return 2;
    }
  }

  sortUsers(a, b) {
    let orderA = this.getPersonaOrder(a.persona);
    let orderB = this.getPersonaOrder(b.persona);

    if (orderA !== orderB) {
      return orderA - orderB;
    } else {
      return a.persona.player_name.localeCompare(b.persona.player_name);
    }
  }

  render() {
    /*
    return React.DOM.div(null, Object.keys(this.props.friends)
      .map(steamID => ({steamID, persona: this.props.personas[steamID]}))
      .filter(entry => entry.persona)
      .sort(this.sortUsers.bind(this))
      .map(entry => React.createElement(UserBlock, {
        steamID: entry.steamID, persona: entry.persona, key: entry.steamID,
        onClick: () => ipc.send("friends:chat", entry.steamID)
      }))
    );
    */

    return React.DOM.div(null, this.props.friendGroups
      .sort((a, b) => (!a.name || !b.name) ? 1 : a.name.localeCompare(b.name))
      .map(group => React.DOM.div({className: "group", key: group.id},
        React.DOM.div({className: "group-header"}, group.name || "Friends"),
        group.members
         .map(steamID => ({steamID, persona: this.props.personas[steamID]}))
         .filter(entry => entry.persona)
         .sort(this.sortUsers.bind(this))
         .map(entry => React.createElement(UserBlock, {
           steamID: entry.steamID, persona: entry.persona, key: entry.steamID,
           onClick: () => ipc.send("friends:chat", entry.steamID)
         }))
      ))
    );
  }
}

module.exports = FriendsList;
