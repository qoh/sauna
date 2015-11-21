// Tray icon by http://froyoshark.deviantart.com (from
// http://www.iconarchive.com/show/enkel-icons-by-froyoshark/Steam-icon.html)

"use strict";

const fs = require("fs");
const prompt = require("cli-prompt");
const notifier = require("node-notifier");
const app = require("app");
const ipc = require("ipc");
const Tray = require("tray");
const Menu = require("menu");
const BrowserWindow = require("browser-window");
const SteamUser = require("steam-user");

const user = new SteamUser(null, {
  promptSteamGuardCode: false
});

const LOGIN_KEY_PATH = `${app.getPath("userData")}/Login Key`;
const APP_ICON_PATH = `${__dirname}/icon.png`;

fs.readFile(LOGIN_KEY_PATH, "utf-8", (err, data) => {
  if (err) {
    prompt.multi([
      {key: "accountName", label: "username"},
      {key: "password", type: "password"},
      {key: "remember", type: "boolean", label: "remember password", default: "true"}
    ], res => {
      console.log("Logging in");

      user.logOn({
        accountName: res.accountName,
        password: res.password,
        rememberPassword: res.remember
      });
    });
  } else {
    console.log("Logging in with key");
    data = JSON.parse(data);

    user.logOn({
      accountName: data.accountName,
      loginKey: data.loginKey
    });
  }
});

user.on("loggedOn", details => {
  console.log("Logged in");
  user.setPersona(SteamUser.Steam.EPersonaState.Online);
});

user.on("steamGuard", (domain, callback) => {
  prompt("steam guard: ", callback);
});

user.on("loginKey", key => {
  const data = {
    accountName: user._logOnDetails.account_name,
    loginKey: key
  };
  
  fs.writeFile(LOGIN_KEY_PATH, JSON.stringify(data), "utf-8", err => {
    if (err) throw err;
  });
});

let friendsWindow = null;
let chatWindow = new Map();

let trayIcon;

user.on("user", (steamId, persona) => {
  let hash = persona.avatar_hash.toHex();
  let url_base = `http://cdn.akamai.steamstatic.com/steamcommunity/public/images/avatars/${hash.substr(0, 2)}/${hash}`;
  persona.avatar_url_full = url_base + "_full.jpg";
  persona.avatar_url_medium = url_base + "_medium.jpg";
  persona.avatar_url_small = url_base + ".jpg";

  let key = steamId.toString();

  if (friendsWindow) {
    friendsWindow.webContents.send("user", key, persona);
  }

  if (chatWindow.has(key)) {
    chatWindow.get(key).webContents.send("user", key, persona);
  }
});

function getChatWindow(steam_id) {
  let key = steam_id.toString();

  if (chatWindow.has(key)) {
    return chatWindow.get(key);
  }

  let window = new BrowserWindow({
    width: 800,
    height: 600,
    title: user.users[steam_id] ? `${user.users[steam_id].player_name} - Sauna` : "... - Sauna",
    icon: APP_ICON_PATH
  });

  window.on("closed", () => chatWindow.delete(key));
  window.on("focus", () => window.flashFrame(false));

  // window.setMenu(null);
  window.setAutoHideMenuBar(true);
  window.loadUrl(`file://${__dirname}/views/chat.html`);
  chatWindow.set(key, window);

  window.webContents.on("did-finish-load", () => {
    window.webContents.didFinishLoad = true;
    window.webContents.send("user", key, user.users[steam_id]);
  });

  return window;
}

function getFriendsWindow() {
  if (friendsWindow) {
    return friendsWindow; // too lazy to indent this block
  }

  friendsWindow = new BrowserWindow({
    width: 600,
    height: 800,
    title: "Friends - Sauna",
    icon: APP_ICON_PATH
  });

  friendsWindow.on("closed", () => friendsWindow = null);
  // friendsWindow.setMenu(null);
  friendsWindow.setAutoHideMenuBar(true);
  friendsWindow.loadUrl(`file://${__dirname}/views/friends.html`);

  friendsWindow.webContents.on("did-finish-load", () => {
    friendsWindow.send("friends", user.myFriends);

    let unknownFriends = [];

    for (let steam_id of Object.keys(user.myFriends)) {
      if (user.users[steam_id]) {
        friendsWindow.send("user", steam_id.toString(), user.users[steam_id]);
      } else {
        unknownFriends.push(steam_id);
      }
    }

    user.getPersonas(unknownFriends);
  });

  return friendsWindow;
}

app.on("window-all-closed", () => {});

app.on("ready", () => {
  trayIcon = new Tray(APP_ICON_PATH);
  trayIcon.setContextMenu(Menu.buildFromTemplate([
    {label: "Friends", click: () => getFriendsWindow().show()},
    {label: "Exit", click: () => app.quit()}
  ]));
  trayIcon.setToolTip("Sauna");
  trayIcon.on("click", () => getFriendsWindow().show());
});

ipc.on("chat", (event, steamId) => {
  getChatWindow(steamId).show();
});

ipc.on("message", (event, steamId,  message) => {
  user.chatMessage(steamId, message);
});

user.on("friendsList", () => {
  getFriendsWindow();
});

notifier.on("click", (notifier, options) => {
  // TODO: don't show the window if it has been closed
  options.window.show();
});

user.on("friendMessage", (sender, message) => {
  let key = sender.toString();
  let window = getChatWindow(sender.toString());

  if (!window.isFocused()) {
    notifier.notify({
      title: user.users[sender].player_name,
      message,
      icon: APP_ICON_PATH,
      window
    });

    window.flashFrame(true);
  }

  if (window.webContents.didFinishLoad) {
    window.webContents.send("message", message);
  } else {
    window.webContents.on("did-finish-load", () => {
      window.webContents.send("message", message);
    });
  }
});
