"use strict";

const EventEmitter = require("events");

const electron = require("electron");
const app = electron.app;
const shell = electron.shell;
const BrowserWindow = electron.BrowserWindow;

const util = require("./util.js");

class ChatGroup extends EventEmitter {
  constructor() {
    super();

    this.chats = [];

    this.window = new BrowserWindow({
      width: sauna.config.get("chat.default-width", 600),
      height: sauna.config.get("chat.default-height", 600),
      title: "Chat",
      icon: path.join(app.getAppPath(), "static/icons/icon_64x.png"),
      show: false
    });

    this.window.setMenu(null);
    this.window.loadURL(`file://${app.getAppPath()}/static/chat.html`);

    this.window.on("closed", () => {
      this.emit("closed");

      this.chats = null;
      this.window = null;
    });

    this.window.webContents.on("will-navigate", (event, url) => {
      if (url !== this.window.webContents.getURL()) {
        shell.openExternal(url);
        event.preventDefault();
      }
    });

    this.window.webContents.on("did-finish-load", () => {
      let personas = {};

      for (let chat of this.chats) {
        personas[chat.steamID] = sauna.user.users[chat.steamID];
      }

      this.window.webContents.send("open", this.chats);
      this.window.webContents.send("personas", personas);
      this.window.showInactive();
    });

    // Should the ChatGroup subscribe to persona update notifications directly
    // when tabs are opened instead? With this, SaunaApp would `.emit()` to the
    // `"persona"` channel on the ChatGroup itself.
    this.on("persona", (steamID, persona) => {
      if (!this.window.webContents.isLoading()) {
        this.window.webContents.send("personas", {[steamID.toString()]: persona});
      }
    });
  }

  openChat(steamID) {
    let key = steamID.toString();

    // TODO: have this passed as an argument?
    let chat = {steamID: key, state: null};
    this.chats.push(chat);

    // If the window has already loaded, notify immediately.
    // Otherwise, this will be sent from the "did-finish-load" event.
    if (!this.window.webContents.isLoading()) {
      this.window.webContents.send("open", [chat]);
      this.window.webContents.send("personas", {[key]: sauna.user.users[steamID]});
    }
  }

  focusChat(steamID) {
    util.onceLoaded(this.window, () => {
      this.window.webContents.send("focus", steamID.toString());
      this.window.focus();
    });
  }
}

module.exports = ChatGroup;
