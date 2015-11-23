"use strict";

const React = require("react");
const electron = require("electron");
const remote = electron.remote;
const Steam = remote.getGlobal("Steam");

const PersonaStateClass = {
  [null]: "offline",
  [Steam.EPersonaState.Offline]: "offline",
  [Steam.EPersonaState.Online]: "online",
	[Steam.EPersonaState.Busy]: "gone",
	[Steam.EPersonaState.Away]: "gone",
	[Steam.EPersonaState.Snooze]: "gone",
	[Steam.EPersonaState.LookingToTrade]: "online",
	[Steam.EPersonaState.LookingToPlay]: "online"
};

const PersonaStateText = {
  [null]: "Offline",
  [Steam.EPersonaState.Offline]: "Offline",
  [Steam.EPersonaState.Online]: "Online",
	[Steam.EPersonaState.Busy]: "Busy",
	[Steam.EPersonaState.Away]: "Away",
	[Steam.EPersonaState.Snooze]: "Snooze",
	[Steam.EPersonaState.LookingToTrade]: "Looking to Trade",
	[Steam.EPersonaState.LookingToPlay]: "Looking to Play"
};

class UserBlock extends React.Component {
  componentDidMount() {
    if (this.props.onClick) {
      ReactDOM.findDOMNode(this).addEventListener("click", this.props.onClick);
    }
  }

  render() {
    let steamID = this.props.steamID;
    let persona = this.props.persona;

    if (!persona) {
      return React.DOM.div(null, `<SteamID ${steamID.toString()}>`);
    }

    let statusClass, statusText;

    if (persona.game_name) {
      statusClass = "ingame";
      statusText = `Playing ${persona.game_name}`;
    } else {
      statusClass = PersonaStateClass[persona.persona_state];
      statusText = PersonaStateText[persona.persona_state];
    }

    return React.DOM.div({className: "user-block " + statusClass},
      React.DOM.img({src: persona.avatar_url_full}),
      React.DOM.div(null,
        React.DOM.div(null, persona.player_name),
        React.DOM.div(null, statusText)
      )
    );
  }
}

module.exports = UserBlock;
