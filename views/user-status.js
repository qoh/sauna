"use strict";

const Steam = require("remote").require("steam-user").Steam;

const PersonaStateOffline = new Set([null, Steam.EPersonaState.Offline]);

const PersonaStateGone = new Set([
  Steam.EPersonaState.Busy,
  Steam.EPersonaState.Away,
  Steam.EPersonaState.Snooze
]);

const PersonaStateName = {
  [null]: "Offline",
  [Steam.EPersonaState.Offline]: "Offline",
  [Steam.EPersonaState.Online]: "Online",
  [Steam.EPersonaState.Busy]: "Busy",
  [Steam.EPersonaState.Away]: "Away",
  [Steam.EPersonaState.Snooze]: "Snooze",
  [Steam.EPersonaState.LookingToTrade]: "Looking to Trade",
  [Steam.EPersonaState.LookingToPlay]: "Looking to Play"
};

function getPersonaOrder(persona) {
  if (persona.game_name) return 0;
  if (PersonaStateGone.has(persona.persona_state)) return 2;
  if (PersonaStateOffline.has(persona.persona_state)) return 3;
  return 1;
}
