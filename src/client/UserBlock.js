/*jshint node: true */
/*jshint esnext: true */

"use strict";

const React = require("react");
const ReactDOM = require("react-dom");
const electron = require("electron");
const remote = electron.remote;
const Steam = remote.getGlobal("Steam");
const personaUtil = require("../persona-util.js");
// Please give destructuring already
const getStatusClass = personaUtil.getStatusClass;
const getStatusText = personaUtil.getStatusText;

class UserBlock extends React.Component {
  componentDidMount() {
    if (this.props.onClick) {
      ReactDOM.findDOMNode(this).addEventListener("click",
        () => this.props.onClick(this.props.steamID));
    }
  }

  render() {
    let persona = this.props.persona;
    let className = `user-block ${getStatusClass(persona)}`;

    return React.DOM.div({className},
      React.DOM.img({src: persona.avatar_url_full}),
      React.DOM.div(null,
        React.DOM.div(null, persona.player_name),
        React.DOM.div(null, getStatusText(persona))
      )
    );
  }
}

module.exports = UserBlock;
