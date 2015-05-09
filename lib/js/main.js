var OS = require("os");
var Path = require("path");
var Writer = require("./writer.js");
var ChampionTable = require("./championTable.js");
var Editor = require("./editor.js");
var Import = require("./import.js");
var Settings = require("./settings.js");
var Version = require("./version.js");
var Async = require("./async.js");

var gOpenChampionsMap = {};
var gTemplate;

function init() {
  document = window.document;
  $ = window.$;

  gTemplate = document.querySelector("template");
  gTemplate.openChampions = [];

  if (OS.platform().toLowerCase().startsWith("win"))
    gTemplate.exeExtension = ".exe";

  // __dirname == appDir/lib/js
  window.appDir = Path.resolve(Path.join(__dirname, "..", ".."));
  window.userDataDir = Path.resolve(Path.join(window.appDir, "UserData"));

  // Startup order:
  // 1. Always wait for templates first.
  // 2. Init settings. Other modules depend on it.
  // 3. Init all other modules. They are independent of each other.
  // 4. Show first-run, if applicable.
  // 5. App is loaded!
  Async.call(function*() {
    yield waitForTemplateBound();
    yield Settings.init();
    Editor.init();
    Version.init();
    Import.init();
    try {
      initMain();
    } catch(e) { toast("Lisa initialization failed:" + e, e); }
    try {
      yield maybeDoFirstRun();
    } catch(e) { console.log("First run failed:", e); }
    try {
      finalizeMain();
    } catch(e) { toast("Lisa finalization failed:" + e, e); }
  });
}

function* waitForTemplateBound() {
  const caller = yield;
  var elem = document.querySelector(".championPicker");
  if (elem) return true;
  gTemplate.addEventListener("template-bound", caller.success);
}

function* maybeDoFirstRun() {
  const caller = yield;
  if (!Settings.isFirstRun())
    return true;

  var firstRunDialog = document.querySelector("#firstrun-dialog");
  firstRunDialog.open();

  firstRunDialog.addEventListener("core-overlay-close-completed", function() {
    Settings.clearFirstRun();
    caller.success();
  });
}

function initMain() {
  gTemplate.hasUnsavedChanges = false;
  gTemplate.saveTapped = Async.cb(function*() {
    var generators = [];
    for (var name in gOpenChampionsMap)
      generators.push(Writer.saveChampion(gOpenChampionsMap[name]));

    try {
      yield generators;
      gTemplate.hasUnsavedChanges = false;
      toast("Saved.");
    } catch(e) {
      toast("Failed to save: " + e, e);
    };
  });
  gTemplate.revertTapped = Async.cb(function*() {
    gTemplate.hasUnsavedChanges = false;
    gOpenChampionsMap = {};
    var openChampions = gTemplate.openChampions;
    gTemplate.openChampions = [];
    var generators = openChampions.map(function(champion) {
      return loadChampion(champion.name);
    });
    yield generators;
    selectChampion(gTemplate.champion.name, false);
  });
  gTemplate.settingsTapped = function() {
    var settingsDialog = document.querySelector("#settings-dialog");
    settingsDialog.open();
  };

  Settings.onLeagueRootChanged(function() {
    if (!Settings.isFirstRun())
      gTemplate.revertTapped();
  });

  $(".championPicker").selectize({
    maxItems: 1,
    valueField: "name",
    labelField: "name",
    searchField: "name",
    options: ChampionTable.getChampionList(),
  });
  $(".championPicker.selectized").on("change", function() {
    selectChampion($(this).val(), true);
  });
  gTemplate.selectChampion = function(event, detail, sender) {
    selectChampion(sender.selectedModel.openChampion.name, true);
  };
}

function finalizeMain() {
  if (!gTemplate.leagueRootValid) {
    toast("Can't find League of Legends."
          + " Please update folder location in Settings.");
  }

  selectChampion(Settings.getCurrentChampion(), false);
}

// Switch the editor to the given champion. If |silent| is true, don't fire
// a change event.
function selectChampion(championName, silent) {
  return Async.toPromise(selectChampionGen(championName, silent));
}

function* selectChampionGen(championName, silent) {
  if (!championName) return true;

  if (!gOpenChampionsMap[championName])
    yield loadChampion(championName);

  gTemplate.champion = gOpenChampionsMap[championName];

  // Update both controls to reflect the current champion.
  for (var i in gTemplate.openChampions) {
    if (gTemplate.openChampions[i].name == championName)
      document.querySelector("core-menu").selected = i;
  }

  document.querySelector(".championPicker").selectize.
      setValue(championName, silent);

  // If this isn't run in a timeout, it messes up with selectize somehow. Fuck
  // it.
  window.setTimeout(function() {
    if (gTemplate.$)
      gTemplate.$.itemSetTabs.selected = 0;
  });

  return true;
}

// Load the given champion from disk, and update our structures to point
// to it.
function* loadChampion(championName) {
  if (!gOpenChampionsMap[championName]) {
    gOpenChampionsMap[championName] = {name: championName};
    gTemplate.openChampions.push(gOpenChampionsMap[championName]);
  }
  var champion = gOpenChampionsMap[championName];

  try {
    var loaded = yield Writer.loadChampion(championName);
    champion.itemSets = loaded.itemSets;
  } catch(e) {
    toast("Failed to load item sets for '" + championName + "': " + e, e);
  }

  // Watch for changes so we can set the dirty bit, used in index.html.
  deepObserve(champion, function(changes) {
    for (var i = 0; i < changes.length; ++i) {
      if (!changes[i].name.startsWith("_lisa")) {
        champion._lisa_changed = true;
        gTemplate.hasUnsavedChanges = true;
      }
    }
  });

  return champion;
}

// Run Object.observe on |obj| and all its current and future descendants.
function deepObserve(obj, cb) {
  if (typeof(obj) != "object") return;
  Object.observe(obj, function(changes) {
    cb(changes);
    changes.forEach(function(change) {
      if (change.type == "add")
        deepObserve(obj[change.name], cb);
    });
  });
  for (var key in obj)
    deepObserve(obj[key], cb);
}

function setUIDisabled(disabled) {
  document.querySelectorAll("html /deep/ input, paper-button")
      .array().forEach(function(e) {
    e.disabled = disabled;
  });
  document.querySelectorAll("html /deep/ paper-spinner")
      .array().forEach(function(e) {
    e.active = disabled;
  });
}

function toast(msg, e) {
  var elem = document.querySelector("paper-toast");
  elem.text = msg;
  elem.show();

  if (e)
    console.error(msg, e && e.stack);
}

exports.init = init;

window.selectChampion = selectChampion;
window.loadChampion = loadChampion;
window.toast = toast;
window.setUIDisabled = setUIDisabled;
