/*jshint node: true */
/*jshint esnext: true */
"use strict";

const fs = require("fs");
const path = require("path");
const EventEmitter = require("events");

const SteamUser = require("steam-user");
const Steam = SteamUser.Steam;

const electron = require("electron");
const app = electron.app;
const ipc = electron.ipcMain;
const shell = electron.shell;
const session = electron.session;
let electronScreen = null;
const Menu = electron.Menu;
const Tray = electron.Tray;
const BrowserWindow = electron.BrowserWindow;

// For renderer processes; this takes a while to load
global.Steam = Steam;

const ConfigStore = require("./ConfigStore.js");
const personaUtil = require("./persona-util.js");

// This also definitely shouldn't be here.
// function sendWhenLoaded(webContents, ...args) {
// Why does Node.js not have ...args yet?
function sendWhenLoaded(webContents) {
  const args = Array.from(arguments).slice(1);

  if (webContents.isLoading()) {
    webContents.once("did-finish-load", () => {
      // webContents.send(...args);
      // Seriously?
      webContents.send.apply(webContents, args);
    });
  } else {
    // webContents.send(...args);
    webContents.send.apply(webContents, args);
  }
}

class SaunaApp extends EventEmitter {
  constructor(options) {
    super();
    app.setAppUserModelId("com.sauna.sauna.1");

    // Cannot initialize "screen" module before app is ready
    electronScreen = electron.screen;

    this.options = options;
    this.notifications = [];

    this.appPath = app.getAppPath();
    this.userPath = app.getPath("userData");

    this.loginWindow = null;
    this.friendsWindow = null;
    this.chatWindows = new Map();

    // Immediately let the user know that we're trying our best.
    this.getLoginWindow().show();

    this.config = new ConfigStore(this.userPath);
    this.desiredStatus = this.config.get("general.startup-status",
      Steam.EPersonaState.Online);

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
          this.getStatusMenuTemplate(),
          {type: "separator"},
          {label: "Library"},
          {label: "Settings"},
          {type: "separator"},
          {label: "Exit", click: () => app.quit()}
        ]));
      }

      if (this.loginWindow) {
        this.loginWindow.close();
      }

      this.user.setPersona(this.desiredStatus);
    });

    this.user.on("steamGuard", (domain, callback) => {
      this.loginSentryCallback = callback;
      this.getLoginWindow().webContents.send("sentry", domain);
    });

    this.user.on("error", error => {
      this.getLoginWindow().webContents.send("error", error.eresult, error.message);
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
        icon: path.join(this.appPath, "static/icons/icon_64x.png"),
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
        persona.has_avatar = false;
      } else {
        persona.has_avatar = true;
      }

      let url_base = `http://cdn.akamai.steamstatic.com/steamcommunity/public/images/avatars/${hash.substr(0, 2)}/${hash}`;

      persona.avatar_url_full = url_base + "_full.jpg";
      persona.avatar_url_medium = url_base + "_medium.jpg";
      persona.avatar_url_small = url_base + ".jpg";

      if (this.user.users[steamID]) {
        let old = this.user.users[steamID];

        if (persona.player_name !== old.player_name) {
          this.notifyEvent("update-name", steamID, {
            title: `${old.player_name} changed their name to`,
            body: persona.player_name
          });
        }

        if (persona.game_name && persona.game_name !== old.game_name) {
          this.notifyEvent("update-status", steamID, {
            title: `${persona.player_name} is now playing`,
            body: persona.game_name
          });
        } else {
          let nowText = personaUtil.getStatusText(persona);
          let oldText = personaUtil.getStatusText(old);

          if (nowText !== oldText) {
            this.notifyEvent("update-status", steamID, {
              title: `${persona.player_name} is now`,
              body: nowText
            });
          }
        }
      }

      let key = steamID.toString();

      if (this.friendsWindow) {
        this.friendsWindow.webContents.send("personas", {[steamID]: persona});
      }

      if (this.chatWindows.has(key)) {
        this.chatWindows.get(key).webContents.send("user", key, persona);
      }
    });

    // this.openFriends();

    this.user.on("friendsList", list => {
      this.openFriends();
    });

    this.user.on("friendMessage", (steamID, message) => {
      let chat = this.getChatWindow(steamID);

      sendWhenLoaded(chat.webContents, "message", {
        isSelf: false,
        isEcho: false,
        senderID: steamID.toString(),
        senderName: this.user.users[steamID].player_name,
        text: message
      });

      if (!chat.isFocused()) {
        this.notifyEvent("message", steamID, {
          title: `${this.user.users[steamID].player_name} said`,
          body: message
        });
      }
    });

    this.user.on("friendMessageEcho", (steamID, message) => {
      let chat = this.getChatWindow(steamID);

      sendWhenLoaded(chat.webContents, "message", {
        isSelf: true,
        isEcho: true,
        senderID: this.user.steamID.toString(),
        senderName: this.user.users[this.user.steamID].player_name,
        text: message
      });
    });

    this.user.on("friendTyping", (steamID, message) => {
      let chat = this.getChatWindow(steamID, true);

      if (chat === null) {
        return;
      }

      if (!chat.webContents.isLoading()) {
        chat.webContents.send("typing");
      } else {
        chat.webContents.once("did-finish-load", () => {
          chat.webContents.send("typing");
        });
      }
    });

    ipc.on("notify", (event, params) => {
      this.openNotification(params);
    });

    ipc.on("notify-desired-height", (event, id, height) => {
      let win = BrowserWindow.fromId(id);
      win.setSize(win.getSize()[0], height);
      this.updateNotifications();

      if (!win.webContents.isLoading()) {
        win.showInactive();
      } else {
        win.didSendHeight = true;
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
      let chat = this.getChatWindow(steamID);

      sendWhenLoaded(chat.webContents, "message", {
        isSelf: true,
        isEcho: false,
        senderID: this.user.steamID.toString(),
        senderName: this.user.users[this.user.steamID].player_name,
        text
      });
    });

    ipc.on("chat:typing", (event, steamID) => {
      this.user.chatTyping(steamID);
    });

    ipc.on("request-trade", (event, steamID) => {
      this.user.trade(steamID);
    });

    this.startLogIn(false);
  }

  receiveOptions(newOptions, workingDirectory) {
    console.log("Got options from new process");
    console.log(newOptions);
  }

  startLogIn(ignoreKey) {
    const autoLogIn = data => {
      console.log("Using login key for", data.accountName);

      this.user.logOn({
        accountName: data.accountName,
        loginKey: data.loginKey,
        rememberPassword: true
      });
    };

    const promptLogIn = () => {
      console.log("Failed to read login key, requesting user login");
      sendWhenLoaded(this.getLoginWindow().webContents, "login");
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

  getLoginWindow() {
    if (this.loginWindow) {
      return this.loginWindow;
    }

    this.loginWindow = new BrowserWindow({
      width: /* 360 */ 400,
      height: 400,
      resizable: false,
      useContentSize: true,
      title: "Sauna",
      icon: path.join(this.appPath, "static/icons/icon_64x.png")
    });

    this.loginWindow.on("closed", () => {
      this.loginWindow = null;

      if (this.user.steamID === null && !this.switchingUser) {
        app.quit();
      }
    });

    this.loginWindow.loadURL(`file://${this.appPath}/static/login.html`);
    this.loginWindow.setMenuBarVisibility(false);

    return this.loginWindow;
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
      width: this.config.get("chat.default-width", 600),
      height: this.config.get("chat.default-height", 600),
      title: "Chat",
      icon: path.join(this.appPath, "static/icons/icon_64x.png"),
      show: false
    });

    this.chatWindows.set(key, chatWindow);

    chatWindow.loadURL(`file://${this.appPath}/static/chat.html#${key}`);
    chatWindow.setMenuBarVisibility(false);
    chatWindow.showInactive();

    chatWindow.on("closed", () => {
      this.chatWindows.delete(key);
    });

    chatWindow.webContents.on("will-navigate", (event, url) => {
      if (url !== chatWindow.webContents.getURL()) {
        shell.openExternal(url);
        event.preventDefault();
      }
    });

    chatWindow.webContents.on("did-finish-load", () => {
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
      icon: path.join(this.appPath, "static/icons/icon_64x.png")
    });

    this.friendsWindow.on("closed", () => {
      this.friendsWindow = null;
    });

    this.friendsWindow.webContents.on("did-finish-load", () => {
      this.friendsWindow.webContents.send("view-change", {
        filterLevel: this.config.get("friends.filter-level", 0),
        sortStatus: this.config.get("friends.sort-status", true),
        showSearch: this.config.get("friends.show-search", true)
      });

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

    let filterLevel = this.config.get("friends.filter-level", 0);

    this.friendsWindow.setMenu(Menu.buildFromTemplate([
      {
        label: "Sauna",
        submenu: [
          this.getStatusMenuTemplate(),
          {type: "separator"},
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
          // FIXME: Ew.
          // This should really be using config.observe and the like!
          {
            label: "Show All", type: "radio",
            checked: filterLevel === 0,
            click: (item, focusedWindow) => {
              focusedWindow.webContents.send("view-change", {filterLevel: 0});
              this.config.set("friends.filter-level", 0);
            }
          },
          {
            label: "Hide Offline", type: "radio",
            checked: filterLevel === 1,
            click: (item, focusedWindow) => {
              focusedWindow.webContents.send("view-change", {filterLevel: 1});
              this.config.set("friends.filter-level", 1);
            }
          },
          {
            label: "Hide Offline && Inactive", type: "radio",
            checked: filterLevel === 2,
            click: (item, focusedWindow) => {
              focusedWindow.webContents.send("view-change", {filterLevel: 2});
              this.config.set("friends.filter-level", 2);
            }
          },
          {type: "separator"},
          // More? Oh no. Seriously, please. Observe the config!
          {
            label: "Sort by Status", type: "checkbox",
            checked: this.config.get("friends.sort-status", true),
            click: (item, focusedWindow) => {
              focusedWindow.webContents.send("view-change", {sortStatus: item.checked});
              this.config.set("friends.sort-status", item.checked);
            }
          },
          {
            label: "Show Search Box", type: "checkbox",
            checked: this.config.get("friends.show-search", true),
            click: (item, focusedWindow) => {
              focusedWindow.webContents.send("view-change", {showSearch: item.checked});
              this.config.set("friends.show-search", item.checked);
            }
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
        name: "Friends",
        members: Array.from(ungrouped)
      });
    }

    return groups;
  }

  getStatusMenuTemplate() {
    let statuses = [
      {label: "Online", value: Steam.EPersonaState.Online},
      {label: "Offline", value: Steam.EPersonaState.Offline},
      {},
      {label: "Busy", value: Steam.EPersonaState.Busy},
      {label: "Away", value: Steam.EPersonaState.Away},
      {label: "Snooze", value: Steam.EPersonaState.Snooze},
      {},
      {label: "Looking to Play", value: Steam.EPersonaState.LookingToPlay},
      {label: "Looking to Trade", value: Steam.EPersonaState.LookingToTrade},
    ];

    return {
      label: "Status",
      submenu: statuses.map(entry => entry.label ? {
        label: entry.label,
        type: "radio",
        groupId: 1,
        click: () => {
          this.user.setPersona(entry.value);
          this.desiredStatus = entry.value;
        }
      } : {
        type: "separator"
      })
    };
  }

  notifyEvent(event, steamID, props) {
    // console.log("notifyEvent", event, steamID);

    const groupID = null; // ???

    let cfgUser = this.config.get(`notifications.user.${steamID}.${event}`, {});
    let cfgGroup = this.config.get(`notifications.group.${groupID}.${event}`, {});
    let cfgAll = this.config.get(`notifications.all.${event}`, {});

    let visual = cfgUser.visual !== undefined ? cfgUser.visual : (
      cfgGroup.visual !== undefined ? cfgGroup.visual : (
        cfgAll.visual !== undefined ? cfgAll.visual : true
      ));

    // let sound = cfgUser.sound !== undefined ? cfgUser.sound : (
    //   cfgGroup.sound !== undefined ? cfgGroup.sound : (
    //     cfgAll.sound !== undefined ? cfgAll.sound : true
    //   ));
    //
    // if (sound === true) {
    //   sound = `file://${this.appPath}/static/sounds/chime_bell_ding.wav`;
    // } else if (sound === false) {
    //   sound = null;
    // }

    if (visual) {
      this.openNotification({
        title: props.title,
        body: props.body,
        image: this.user.users[steamID].avatar_url_full,
        clickSend: ["friends:chat", steamID.toString()]
      });
    }
  }

  updateNotifications() {
    let screenSize = electronScreen.getPrimaryDisplay().workAreaSize;

    let mulX = Number(this.config.get("notifications.orient-x", false));
    let mulY = Number(this.config.get("notifications.orient-y", false));
    let baseX = this.config.get("notifications.base-x", 0);
    let baseY = this.config.get("notifications.base-y", 24);
    let signX = mulX ? -1 : 1;
    let signY = mulY ? -1 : 1;
    let spacing = this.config.get("notifications.spacing", 12);

    let x = screenSize.width * mulX + baseX * signX;
    let y = screenSize.height * mulY + baseY * signY;

    for (let i = this.notifications.length - 1; i >= 0; i--) {
      let note = this.notifications[i];
      let noteSize = note.getSize();
      note.setPosition(x - noteSize[0] * mulX, y - noteSize[1] * mulY);
      y += (noteSize[1] + spacing) * signY;
    }
  }

  openNotification(options) {
    let note = new BrowserWindow({
      width: 275,
      height: 250,
      minWidth: 275,
      minHeight: 1,
      useContentSize: true,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      frame: false,
      type: "notification"
    });

    note.on("closed", () => {
      let index = this.notifications.indexOf(note);

      if (index !== -1) {
        this.notifications.splice(index, 1);
        this.updateNotifications();
      }
    });

    this.notifications.push(note);

    note.webContents.on("did-finish-load", () => {
      if (note.didSendHeight) {
        note.showInactive();
      }
    });

    let hash = encodeURIComponent(JSON.stringify({
      id: note.id,
      options
    }));

    note.setMenuBarVisibility(false);
    note.loadURL(`file://${this.appPath}/static/notification.html#${hash}`);
  }
}

module.exports = SaunaApp;
