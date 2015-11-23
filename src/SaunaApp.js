/*jshint node: true */
/*jshint esnext: true */
"use strict";

const fs = require("fs");
const path = require("path");
const EventEmitter = require("events");
const SteamUser = require("steam-user");
const electron = require("electron");

const Steam = SteamUser.Steam;
const app = electron.app;
const ipc = electron.ipcMain;
const session = electron.session;
const Menu = electron.Menu;
const Tray = electron.Tray;
const BrowserWindow = electron.BrowserWindow;

// For renderer processes; this takes a while to load
global.Steam = Steam;

class SaunaApp extends EventEmitter {
  constructor(options) {
    super();

    this.options = options;

    this.appPath = app.getAppPath();
    this.userPath = app.getPath("userData");

    this.loginWindow = null;
    this.friendsWindow = null;
    this.chatWindows = new Map();

    this.user = new SteamUser(null, {
      dataDirectory: this.userPath,
      promptSteamGuardCode: false,
    });

    app.on("window-all-closed", () => {
      if (!this.tray && !this.switchingUser) {
        app.quit();
      }
    });

    app.on("before-quit", event => {
      if (this.user.steamID !== null) {
        this.user.logOff(); // TODO: actually wait for this
      }
    });

    this.user.on("loggedOn", () => {
      console.log("Logged in");

      if (!this.tray && this.options.tray) {
        this.tray = new Tray(path.join(this.appPath, "static/icons/icon_16x.png"));
        this.tray.setToolTip("Sauna");
        this.tray.setContextMenu(Menu.buildFromTemplate([
          {label: "Friends", click: () => this.openFriends()},
          {label: "Library"},
          {label: "Settings"},
          {type: "separator"},
          {label: "Exit", click: () => app.quit()}
        ]));
      }

      if (this.loginWindow) {
        this.loginWindow.close();
      }

      this.user.setPersona(Steam.EPersonaState.Online);
      console.log("Online");
    });

    this.user.on("steamGuard", (domain, callback) => {
      if (!this.loginWindow) {
        throw new Error("steamGuard without loginWindow");
      }

      this.loginSentryCallback = callback;
      this.loginWindow.webContents.send("sentry", domain);
    });

    this.user.on("error", error => {
      console.log("error", error);

      if (!this.loginWindow) {
        throw error;
      }

      this.loginWindow.webContents.send("error", error.eresult, error.message);
    });

    this.user.on("disconnected", eresult => {
      console.log("disconnected", eresult);
    });

    this.user.on("webSession", (sessionID, cookies) => {
      this.webSessionID = sessionID;
      this.webCookies = cookies;

      // FIXME: This is a bit of a mess.
      let sess = session.fromPartition("persist:steamweb");
      let toSet = this.webCookies;

      const finishSet = function() {
      };

      const setNext = function(error) {
        if (error) throw error;
        if (!cookies.length) return finishSet();

        let pair = cookies[0].split("=", 2);
        cookies = cookies.slice(1);
        sess.cookies.set({
          url: "http://steamcommunity.com",
          name: pair[0],
          value: pair[1]
        }, setNext);
      };

      setNext(undefined);
    });

    this.user.on("loginKey", key => {
      let data = JSON.stringify({
        accountName: this.user._logOnDetails.account_name,
        loginKey: key
      });

      fs.writeFile(path.join(this.userPath, "Login Key"), data, (err) => {
        if (err) {
          console.log("Failed to save login key");
          console.log(err);
        }

        console.log("Saved login key");
      });
    });

    this.user.on("tradeRequest", (steamID, respond) => {
      console.log("Incoming trade request from", steamID);
      respond(true);
    });

    this.user.on("tradeStarted", (steamID) => {
      console.log("Starting trade with", steamID);

      let trade = new BrowserWindow({
        width: 1000,
        height: 800,
        title: "Trade",
        icon: path.join(this.appPath, "static/icons/icon_32x.png"),
        webPreferences: {
          nodeIntegration: false,
          partition: "persist:steamweb",
          webSecurity: false
        }
      });

      trade.setMenu(null);
      trade.loadURL(`http://steamcommunity.com/trade/${steamID}`);
    });

    this.user.on("user", (steamID, persona) => {
      let hash = persona.avatar_hash.toHex();

      // No avatar
      if (hash === "0000000000000000000000000000000000000000") {
        hash = "fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb";
      }

      let url_base = `http://cdn.akamai.steamstatic.com/steamcommunity/public/images/avatars/${hash.substr(0, 2)}/${hash}`;

      persona.avatar_url_full = url_base + "_full.jpg";
      persona.avatar_url_medium = url_base + "_medium.jpg";
      persona.avatar_url_small = url_base + ".jpg";

      let key = steamID.toString();

      if (this.friendsWindow) {
        this.friendsWindow.webContents.send("personas", {[steamID]: persona});
      }

      if (this.chatWindows.has(steamID)) {
        this.chatWindows.get(steamID).webContents.send("user", key, persona);
      }
    });

    this.user.on("friendsList", list => {
      console.log("Got friends list");
      this.openFriends();
    });

    this.user.on("friendMessage", (steamID, message) => {
      let chat = this.getChatWindow(steamID);

      if (chat.webContents.didFinishLoad) {
        chat.webContents.send("message", steamID.toString(), message);
      } else {
        chat.webContents.once("did-finish-load", () => {
          chat.webContents.send("message", steamID.toString(), message);
        });
      }
    });

    this.user.on("friendMessageEcho", (steamID, message) => {
      let chat = this.getChatWindow(steamID);

      if (chat.webContents.didFinishLoad) {
        chat.webContents.send("message", null, message);
      } else {
        chat.webContents.once("did-finish-load", () => {
          chat.webContents.send("message", null, message);
        });
      }
    });

    this.user.on("friendTyping", (steamID, message) => {
      let chat = this.getChatWindow(steamID, true);

      if (chat === null) {
        return;
      }

      if (chat.webContents.didFinishLoad) {
        chat.webContents.send("typing");
      } else {
        chat.webContents.once("did-finish-load", () => {
          chat.webContents.send("typing");
        });
      }
    });

    ipc.on("login", (event, params) => {
      this.user.logOn(params);
    });

    ipc.on("login:sentry", (event, code) => {
      if (this.loginSentryCallback) {
        this.loginSentryCallback(code);
        this.loginSentryCallback = null;
      } else {
        throw new Error("login:sentry without callback");
      }
    });

    ipc.on("friends:chat", (event, steamID) => {
      this.getChatWindow(steamID).focus();
    });

    ipc.on("chat:message", (event, steamID, text) => {
      this.user.chatMessage(steamID, text);
    });

    ipc.on("chat:typing", (event, steamID) => {
      this.user.chatTyping(steamID);
    });

    this.startLogIn(false);
  }

  startLogIn(ignoreKey) {
    const autoLogIn = data => {
      console.log("Using login key");

      this.user.logOn({
        accountName: data.accountName,
        loginKey: data.loginKey,
        rememberPassword: true
      });
    };

    const promptLogIn = () => {
      console.log("Failed to read login key, requesting user login");

      // We don't have a valid login key, so let's ask the user to login.
      this.loginWindow = new BrowserWindow({
        width: /* 360 */ 400,
        height: 400,
        resizable: false,
        useContentSize: true,
        title: "Login",
        icon: path.join(this.appPath, "static/icons/icon_32x.png")
      });

      this.loginWindow.on("closed", () => {
        this.loginWindow = null;

        if (this.user.steamID === null && !this.switchingUser) {
          app.quit();
        }
      });

      this.loginWindow.loadURL(`file://${this.appPath}/static/login.html`);
      this.loginWindow.setMenuBarVisibility(false);
    };

    fs.readFile(path.join(this.userPath, "Login Key"), "utf-8", (err, data) => {
      if (!err) {
        try {
          data = JSON.parse(data);
        } catch (newErr) {
          err = newErr;
        }
      }

      if (err) {
        promptLogIn();
      } else {
        autoLogIn(data);
      }
    });
  }

  getChatWindow(steamID, noCreate) {
    let key = steamID.toString();

    if (this.chatWindows.has(key)) {
      return this.chatWindows.get(key);
    }

    if (noCreate) {
      return null;
    }

    let chatWindow = new BrowserWindow({
      width: 800, height: 600,
      title: "Chat",
      icon: path.join(this.appPath, "static/icons/icon_32x.png"),
      show: false
    });

    this.chatWindows.set(key, chatWindow);

    chatWindow.loadURL(`file://${this.appPath}/static/chat.html`);
    chatWindow.setMenuBarVisibility(false);
    chatWindow.showInactive();

    chatWindow.on("closed", () => {
      this.chatWindows.delete(key);
    });

    chatWindow.webContents.on("did-finish-load", () => {
      chatWindow.webContents.didFinishLoad = true;
      chatWindow.webContents.send("user",
        key, this.user.users[steamID]);
    });

    return chatWindow;
  }

  openFriends() {
    if (this.friendsWindow) {
      this.friendsWindow.focus();
      return;
    }

    this.friendsWindow = new BrowserWindow({
      width: 300, height: 600,
      show: false,
      title: "Friends",
      icon: path.join(this.appPath, "static/icons/icon_32x.png")
    });

    this.friendsWindow.on("closed", () => {
      this.friendsWindow = null;
    });

    this.friendsWindow.webContents.on("did-finish-load", () => {
      this.friendsWindow.webContents.send("personas", this.user.users);

      let missingPersonas =
        Object.keys(this.user.myFriends)
          .filter(steamID => !this.user.users[steamID]);

      if (missingPersonas.length > 0) {
        this.user.getPersonas(missingPersonas, (personas) => {
          this.friendsWindow.webContents.send("personas", personas);
        });
      }

      this.friendsWindow.webContents.send("groups", this.buildFriendGroupList());
      this.friendsWindow.webContents.send("friends", this.user.myFriends);
    });

    this.friendsWindow.setMenu(Menu.buildFromTemplate([
      {
        label: "Sauna",
        submenu: [
          {
            label: "Switch User",
            click: (item, focusedWindow) => {
              console.log("Switching user");
              this.switchingUser = true;

              if (focusedWindow) {
                console.log("Closing login");
                focusedWindow.close();
              }

              console.log("Logging off");
              this.user.logOff();
            }
          },
          {label: "Quit", click: () => app.quit()}
        ],
      },
      {
        label: "View",
        submenu: [
          {
            label: "Show Offline Friends", type: "checkbox",
            checked: true, // TODO: load from settings
            click: (item, focusedWindow) => focusedWindow.webContents
              .send("view-change", {showOffline: item.checked})
          },
          {
            label: "Show in Groups", type: "checkbox",
            checked: true, // TODO: load from settings
            click: (item, focusedWindow) => focusedWindow.webContents
              .send("view-change", {showGroups: item.checked})
          },
          {
            label: "Sort by Status", type: "checkbox",
            checked: true, // TODO: load from settings
            click: (item, focusedWindow) => focusedWindow.webContents
              .send("view-change", {sortStatus: item.checked})
          },
          {
            label: "Show Search Box", type: "checkbox",
            checked: true, // TODO: load from settings
            click: (item, focusedWindow) => focusedWindow.webContents
              .send("view-change", {showSearch: item.checked, search: ""})
          }
        ]
      },
      {
        label: "Developer",
        submenu: [
          {
            label: "Reload",
            accelerator: "CmdOrCtrl+R",
            click: (item, focusedWindow) => {
              if (focusedWindow) {
                focusedWindow.reload();
              }
            }
          },
          {
            label: "Toggle Developer Tools",
            accelerator: process.platform == "darwin" ?
              "Alt+Command+I" : "Ctrl+Shift+I",
            click(item, focusedWindow) {
              if (focusedWindow) {
                focusedWindow.toggleDevTools();
              }
            }
          },
        ]
      }
    ]));

    this.friendsWindow.loadURL(`file://${this.appPath}/static/friends.html`);
    this.friendsWindow.show();
  }

  buildFriendGroupList() {
    let groups = [];
    let ungrouped = new Set(Object.keys(this.user.myFriends).map(steamID => steamID.toString()));

    for (let groupID of Object.keys(this.user.myFriendGroups)) {
      let group = {
        id: groupID,
        name: this.user.myFriendGroups[groupID].name,
        members: []
      };

      for (let steamID of this.user.myFriendGroups[groupID].members) {
        ungrouped.delete(steamID.toString());
        group.members.push(steamID.toString());
      }

      groups.push(group);
    }

    if (ungrouped.size > 0) {
      groups.push({
        id: null,
        name: null,
        members: Array.from(ungrouped)
      });
    }

    return groups;
  }
}

module.exports = SaunaApp;
