/*jshint node: true */
/*jshint esnext: true */
"use strict";

// Cache these because they're IPC-accessed
const EPersonaState = {};
{
  const Steam = require("electron").remote.getGlobal("Steam");

  for (let key of Object.keys(Steam.EPersonaState)) {
    EPersonaState[key] = Steam.EPersonaState[key];
  }
}

const setOffline = new Set([
  null,
  EPersonaState.Offline
]);

const setInactive = new Set([
  EPersonaState.Busy,
  EPersonaState.Away,
  EPersonaState.Snooze
]);

const setOnline = new Set([
  EPersonaState.Online,
  EPersonaState.LookingToTrade,
  EPersonaState.LookingToPlay
]);

const stateNames = {
  [null]: "Offline",
  [EPersonaState.Offline]: "Offline",
  [EPersonaState.Online]: "Online",
	[EPersonaState.Busy]: "Busy",
	[EPersonaState.Away]: "Away",
	[EPersonaState.Snooze]: "Snooze",
	[EPersonaState.LookingToTrade]: "Looking to Trade",
	[EPersonaState.LookingToPlay]: "Looking to Play"
};

module.exports.getStatusText = persona => {
  if (persona.game_name) {
    return `Playing ${persona.game_name}`;
  } else {
    return stateNames[persona.persona_state];
  }
};

module.exports.getStatusClass = persona => {
  if (persona.game_name) {
    return "ingame";
  } else if (setOnline.has(persona.persona_state)) {
    return "online";
  } else if (setInactive.has(persona.persona_state)) {
    return "inactive";
  } else if (setOffline.has(persona.persona_state)) {
    return "offline";
  } else { // I am error
    return "offline";
  }
};

// This repetition sucks
module.exports.getStatusOrder = persona => {
  if (persona.game_name) {
    return 0; // In-Game
  } else if (setOnline.has(persona.persona_state)) {
    return 1; // Online
  } else if (setInactive.has(persona.persona_state)) {
    return 2; // Inactive
  } else if (setOffline.has(persona.persona_state)) {
    return 3; // Offline
  } else {
    return 4; // I am error
  }
};

module.exports.setOffline = setOffline;
module.exports.setInactive = setInactive;
module.exports.setOnline = setOnline;
module.exports.stateNames = stateNames;
