/*jshint node: true */
/*jshint esnext: true */

"use strict";

const React = require("react");
const ReactDOM = require("react-dom");

const electron = require("electron");
const ipc = electron.ipcRenderer;
const UserBlock = require("../src/client/UserBlock.js");

const STATE_OFFLINE = 0;
const STATE_ONLINE = 1;

function getPersonaOrder(persona) {
  if (persona.game_name) {
    return 0;
  } else if (persona.persona_state === STATE_ONLINE) {
    return 1;
  } else if (
    persona.persona_state === STATE_OFFLINE ||
    persona.persona_state === null
  ) {
    return 3;
  } else {
    return 2;
  }
}

class FriendsList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      friends: {},
      personas: {},
      groups: [],

      search: "",
      sortStatus: true,
      showSearch: true,
      showOffline: true,
      showGroups: true
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
    console.log("got personas", patch);

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
      ((persona.persona_state || 0) !== 0 || this.state.showOffline) &&
      (this.state.search === "" || persona.player_name.toLowerCase().indexOf(this.state.search.toLowerCase()) != -1);
  }

  sortUsers(a, b) {
    let orderA = getPersonaOrder(a.persona);
    let orderB = getPersonaOrder(b.persona);

    if (this.state.sortStatus && orderA !== orderB) {
      return orderA - orderB;
    } else {
      return a.persona.player_name.localeCompare(b.persona.player_name);
    }
  }

  sortGroups(a, b) {
    if (a.name === null) {
      return b.name === null ? 0 : 1;
    } else if (b.name === null) {
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
    const sortGroups = this.sortGroups.bind(this);

    let renderSteamIDs = steamIDs => steamIDs
      // Turn [steamID] into {steamID, persona}
      .map(steamID => ({steamID, persona: this.state.personas[steamID]}))
      .filter(filterUsers)
      .sort(sortUsers)
      // Create a UserBlock for each user
      .map(entry => React.createElement(UserBlock, {
        steamID: entry.steamID, persona: entry.persona, key: entry.steamID,
        onClick: () => ipc.send("friends:chat", entry.steamID)
      }));

    let settings = React.DOM.div(null,
      this.state.showSearch ?
        React.DOM.input({
          type: "text",
          value: this.state.search,
          onChange: this.handleSearchChange.bind(this)
        }) :
        undefined
    );

    if (!this.state.showGroups) {
      return React.DOM.div(null, settings, renderSteamIDs(Object.keys(this.state.friends)));
    }

    return React.DOM.div(null,
      settings,
      this.state.groups
        // Sort the groups by name with Friends at the end
        .sort(this.sortGroups)
        // Turn each group into a <div class="group">
        .map(group => React.DOM.div({className: "group", key: group.id},
          // Header with group name...
          React.DOM.div({className: "group-header"}, group.name || "Friends"),
          renderSteamIDs(group.members)
        ))
    );
  }
}

ReactDOM.render(React.createElement(FriendsList), container);
