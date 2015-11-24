/*jshint node: true */
/*jshint esnext: true */

"use strict";

const React = require("react");
const ReactDOM = require("react-dom");

const electron = require("electron");
const ipc = electron.ipcRenderer;
const UserBlock = require("../src/client/UserBlock.js");
const personaUtil = require("../src/client/persona-util.js");

class FriendGroup extends React.Component {
  render() {
    let group = this.props.group;

    if (this.props.collapsed) {
      return React.DOM.div({key: group.id},
        React.DOM.div({className: "group-header collapsed"}, group.name)
      );
    }

    return React.DOM.div({key: group.id},
      React.DOM.div({className: "group-header"}, group.name),
      group.members.map(entry =>
        React.createElement(UserBlock, {
          key: entry.steamID,
          steamID: entry.steamID, persona: entry.persona,
          onClick: () => ipc.send("friends:chat", entry.steamID)
        }))
    );
  }
}

class FriendList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      friends: {},
      personas: {},
      groups: [],

      showOffline: true,
      showInactive: true,
      sortStatus: true,
      showSearch: true,
      search: "",

      collapsed: {}
    };
  }

  componentDidMount() {
    this.boundOnPersonas = this.onPersonas.bind(this);
    this.boundOnFriends = this.onFriends.bind(this);
    this.boundOnGroups = this.onGroups.bind(this);
    this.boundOnViewChange = this.onViewChange.bind(this);

    ipc.on("personas", this.boundOnPersonas);
    ipc.on("friends", this.boundOnFriends);
    ipc.on("groups", this.boundOnGroups);
    ipc.on("view-change", this.boundOnViewChange);
  }

  componentWillUnmount() {
    ipc.removeListener("personas", this.boundOnPersonas);
    ipc.removeListener("friends", this.boundOnFriends);
    ipc.removeListener("groups", this.boundOnGroups);
    ipc.removeListener("view-change", this.boundOnViewChange);
  }

  onPersonas(event, patch) {
    function notify(steamID, title, body) {
      ipc.send("notify", {
        title,
        body,
        clickSend: ["friends:chat", steamID]
      });

      // let note = new Notification(title, {
      //   body,
      //   silent: false,
      //   icon: "icons/icon_32x.png",
      //   sound: "sounds/chime_bell_ding.wav"
      // });
      //
      // if (steamID) {
      //   note.onclick = () => ipc.send("friends:chat", steamID);
      // }
    }

    for (let steamID of Object.keys(patch)) {
      let now = patch[steamID];
      let old = this.state.personas[steamID];

      if (old) {
        if (now.player_name !== old.player_name) {
          ipc.send("notify", {
            title: `${old.player_name} changed their name to`,
            body: now.player_name,
            image: now.avatar_url_full,
            sendClick: ["friends:chat", steamID]
          });
        }

        if (now.game_name && now.game_name !== old.game_name) {
          ipc.send("notify", {
            title: `${now.player_name} is now playing`,
            body: now.game_name,
            image: now.avatar_url_full,
            sendClick: ["friends:chat", steamID]
          });
        } else {
          let nowText = personaUtil.getStatusText(now);
          let oldText = personaUtil.getStatusText(old);

          if (nowText !== oldText) {
            ipc.send("notify", {
              title: `${now.player_name} is now`,
              body: nowText,
              image: now.avatar_url_full,
              sendClick: ["friends:chat", steamID]
            });
          }
        }
      }
    }

    this.setState({
      personas: Object.assign({}, this.state.personas, patch)
    });
  }

  onFriends(event, patch) {
    this.setState({
      friends: Object.assign({}, this.state.friends, patch)
    });
  }

  onGroups(event, groups) {
    this.setState({groups});
  }

  onViewChange(event, changes) {
    this.setState(changes);
  }

  filterUsers(entry) {
    let steamID = entry.steamID;
    let persona = entry.persona;

    return persona &&
      (this.state.showOffline || !personaUtil.setOffline.has(persona.persona_state)) &&
      (this.state.showInactive || !personaUtil.setInactive.has(persona.persona_state) || persona.game_name) &&
      (this.state.search === "" || persona.player_name.toLowerCase().indexOf(this.state.search.toLowerCase()) != -1);
  }

  sortUsers(a, b) {
    let orderA = personaUtil.getStatusOrder(a.persona);
    let orderB = personaUtil.getStatusOrder(b.persona);

    if (this.state.sortStatus && orderA !== orderB) {
      return orderA - orderB;
    } else {
      return a.persona.player_name.localeCompare(b.persona.player_name);
    }
  }

  sortGroups(a, b) {
    if (a.id === null) {
      return b.id === null ? 0 : 1;
    } else if (b.id === null) {
      return -1;
    } else {
      return a.name.localeCompare(b.name);
    }
  }

  handleSearchChange(event) {
    this.setState({search: event.target.value});
  }

  render() {
    const filterUsers = this.filterUsers.bind(this);
    const sortUsers = this.sortUsers.bind(this);

    // Convert [steamID] into [{steamID, persona}],
    // filtered and sorted according to the user's view settings
    let transformSteamIDs = steamIDs => steamIDs
      .map(steamID => ({
        steamID,
        persona: this.state.personas[steamID]
      }))
      .filter(filterUsers)
      .sort(sortUsers);

    return React.DOM.div(null,
      // Include a search box at the top
      this.state.showSearch ?
        React.DOM.input({
          type: "text", value: this.state.search,
          onChange: this.handleSearchChange.bind(this)
        }) : undefined,
      // For every group we've received so far...
      this.state.groups
        // Transform the member list and fix up the name
        .map(group => ({
          id: group.id, name: group.name,
          members: transformSteamIDs(group.members)
        }))
        // Hide groups with no members (yet) in them
        .filter(group => group.members.length)
        // Sort the groups by name with Friends at the end
        .sort(this.sortGroups.bind(this))
        // Finally create a <FriendGroup /> for each
        .map(group => React.createElement(FriendGroup, {
          key: group.id, group,
          collapsed: !!this.state.collapsed[group.id]
        }))
    );
  }
}

ReactDOM.render(React.createElement(FriendList), container);
