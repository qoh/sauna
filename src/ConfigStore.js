// TODO:
// Support specifying defaults for settings in a central place, rather than
// where they're accessed. This should apply deep into read objects as well.

"use strict";

const fs = require("fs");
const path = require("path");
const keyPathHelpers = require("key-path-helpers");

function deepClone(value) {
  if (value instanceof Array) {
    return value.map(inner => deepClone(inner));
  } else if (value instanceof Object) {
    let clone = {};

    for (let key of Object.keys(value)) {
      clone[key] = deepClone(value[key]);
    }
  } else {
    return value;
  }
}

class ConfigStore {
  constructor(userPath) {
    this.data = null;
    this.filename = path.join(userPath, "config.json");

    // Something something asynchronous...
    console.log("Loading user config...");
    let json;

    try {
      json = fs.readFileSync(this.filename, "utf-8");
    } catch (error) {
      console.log("Could not read any user config, creating new.");
      this.data = {};
      this.save();
      return;
    }

    try {
      this.data = JSON.parse(json);

      if (typeof this.data !== "object") {
        throw new TypeError("config data must be object");
      }
    } catch (error) {
      console.log("Failed to read user config: " + error.message);
      console.log("Backing up config and creating new.");

      try {
        this.renameSync(this.filename, this.filename + ".bak");
      } catch (error) {
        console.log("Failed to back up invalid user config: " + error.message);
      }

      this.data = {};
      this.save();
      return;
    }

    // Got it. Cool.
  }

  save() {
    // I was originally writing this as async, but that could cause problems
    // with multiple fs.writeFile calls going on at the same time.

    let data = JSON.stringify(this.data);

    try {
      fs.writeFileSync(this.filename, data);
    } catch (error) {
      console.log("Failed to write user config: " + error.message);
      return false;
    }

    return true;
  }

  get(keyPath, defaultValue) {
    let value = keyPathHelpers.getValueAtKeyPath(this.data, keyPath);

    if (value === undefined) {
      value = defaultValue;
    }

    return deepClone(value);
  }

  set(keyPath, value) {
    if (value === undefined) {
      return this.unset(keyPath);
    }

    keyPathHelpers.setValueAtKeyPath(this.data, keyPath, value);

    // For now.. just save whenever *anything* changes. It's pretty bad.
    this.save();
  }

  unset(keyPath) {
    keyPathHelpers.deleteValueAtPath(this.data, keyPath);
  }
}

module.exports = ConfigStore;
