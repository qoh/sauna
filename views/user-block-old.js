"use strict";

const Steam = require("steam-user").Steam;

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

function createUserBlock(steamId) {
  let element = document.createElement("div");
  element.className = "user-block status-offline";

  let img = document.createElement("img");
  img.className = "user-block-avatar";
  element.appendChild(img);

  let right = document.createElement("div");

  let div_name = document.createElement("div");
  div_name.className = "user-block-name";
  div_name.textContent = steamId || "";
  right.appendChild(div_name);

  let div_status = document.createElement("div");
  div_status.className = "user-block-status";
  div_status.textContent = "Offline";
  right.appendChild(div_status);

  let div_game = document.createElement("div");
  div_game.className = "user-block-game";
  right.appendChild(div_game);

  element.appendChild(right);
  return element;
}

function updateUserBlock(element, persona) {
  let div_status = element.querySelector(".user-block-status");

  if (persona.game_name) {
    div_status.textContent = "In-Game";
    element.className = "user-block status-ingame";
  } else {
    if (persona.persona_state == null ||
        persona.persona_state == Steam.EPersonaState.Offline) {
      element.className = "user-block status-offline";
    } else {
      element.className = "user-block";
    }

    div_status.textContent = PersonaStateName[persona.persona_state];
  }

  element.querySelector(".user-block-avatar").src = persona.avatar_url_full;
  element.querySelector(".user-block-name").textContent = persona.player_name;
  element.querySelector(".user-block-game").textContent = persona.game_name || "";
}

