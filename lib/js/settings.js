var FS = require("fs");
var Path = require("path");
var OS = require("os");
var SwfExtractor = require("./swfExtractor.js");
var Async = require("./async.js");

var kSettingsPath;

var gSettings;
var gScheduleID;
var gTemplate;
var gOnLeagueRootChanged;

function* init() {
  kSettingsPath = window.userDataDir + "/settings.json";

  gSettings = {
    firstRun: true,
    currentChampion: "Udyr",
    leagueRoot: getDefaultLeagueRoot(),
    windowSize: {width: window.outerWidth, height: window.outerHeight},
    showItemNames: false,
    itemPickerOpenOnFocus: true,
  };

  gTemplate = document.querySelector("template");

  window.addEventListener("resize", function() {
    gSettings.windowSize.width = window.outerWidth;
    gSettings.windowSize.height = window.outerHeight;
    scheduleSave();
  });

  // Ugly hack to disable re-entrant change events, because I don't know a
  // better way.
  var ignoreChanged = false;
  gTemplate.leagueRootChanged = function(e, d, sender) {
    if (ignoreChanged) return;
    ignoreChanged = true;

    try {
      var file = sender.files[0];
      if (!file)  // Cancelled: restore the old value.
        return updateLeagueRootElements();

      gSettings.leagueRoot = leagueExeToDir(file.path);
      scheduleSave();
      Async.run(function*() {
        yield onLeagueRootChanged();
        if (gOnLeagueRootChanged)
          gOnLeagueRootChanged();
      });
    } finally {
      ignoreChanged = false;
    }
  };

  gTemplate.showItemNamesChanged = function(e, d, sender) {
    scheduleSave();
  };

  var elem = document.querySelector(".championPicker");
  var oldChange = elem.onchange;
  // For some reason, this is the only way to receive the onchange event for
  // selectized elements.
  elem.onchange = function() {
    gSettings.currentChampion = this.selectize.getValue();
    scheduleSave();
    if (oldChange) oldChange();
  };

  try {
    yield setupUserDataDir();
    yield load();

    // Only resize if necessary. Also, resizing messes with the firstRun
    // dialog, so this fixes a bug.
    if (!gSettings.firstRun)
      window.resizeTo(gSettings.windowSize.width, gSettings.windowSize.height);

    gTemplate.settings = gSettings;
    yield onLeagueRootChanged();
    return true;
  } catch(e) {
    console.log("Failed to finalize settings: ", e);
    return false;
  };
}

function scheduleSave() {
  if (gScheduleID)
    window.clearTimeout(gScheduleID);
  gScheduleID = window.setTimeout(save, 1000);
}

function* setupUserDataDir() {
  const caller = yield;
  FS.mkdir("./UserData", function(err) {
    if (err && err.code != "EEXIST")
      console.error("Couldn't create UserData dir:", err);
    caller.success();
  });
}

function save() {
  FS.writeFile(kSettingsPath, JSON.stringify(gSettings), function(err) {
    if (err) return console.error("Failed saving settings.", err);
    console.log("Settings saved.");
  });
}

function* load() {
  const caller = yield;

  function fail(e) {
    console.warn("Failed to load settings: ", e);
    caller.success();
  }
  FS.readFile(kSettingsPath, function(err, data) {
    if (err) return fail(err);
    try {
      var loadedSettings = JSON.parse(data);
      if (loadedSettings.leagueRoot && loadedSettings.windowSize)
        gSettings = loadedSettings;
    } catch(e) {
      return fail(e);
    }
    caller.success();
  });
}

function getDefaultLeagueRoot() {
  // Using exceptions is silly, but node.js doesn"t have a better sync way of
  // testing for a directory.
  var dir = "C:/Riot Games/League of Legends";
  try { if (FS.statSync(dir).isDirectory()) return dir; } catch(e) {};
  var dir = "D:/Riot Games/League of Legends";
  try { if (FS.statSync(dir).isDirectory()) return dir; } catch(e) {};
  var dir = "/Applications/Leauge of Legends";
  try { if (FS.accessSync(dir)) return dir; } catch(e) {};
  var dir = "/Applications/Leauge of Legends.app";
  try { if (FS.accessSync(dir)) return dir; } catch(e) {};
  var dir = "~/Applications/Leauge of Legends";
  try { if (FS.accessSync(dir)) return dir; } catch(e) {};
  var dir = "~/Applications/Leauge of Legends.app";
  try { if (FS.accessSync(dir)) return dir; } catch(e) {};
  var dir = "./";
  return dir;
}

// Common tasks when the league root is updated, either by the user or by us.
function* onLeagueRootChanged() {
  updateLeagueRootElements();
  try {
    yield SwfExtractor.extract();
  } catch(e) {
    gSettings.showItemNames = true;
    window.toast("Couldn't find item icons. Item images will be broken.", e);
  }
  yield validateLeagueRoot();
  return true;
}

// Check our leagueRoot setting to see if it points to a valid League of Legends
// folder.
function* validateLeagueRoot() {
  const caller = yield;

  FS.stat(gSettings.leagueRoot, function(err, stats) {
    gTemplate.leagueRootExists = (stats && stats.isDirectory());

    FS.stat(Path.join(gSettings.leagueRoot,
                      "RADS", "projects", "lol_air_client"),
                      function(err, stats) {
      gTemplate.leagueRootValid = (stats && stats.isDirectory());
      caller.success();
    });
  });
}

// Update our leagueRoot filepickers to reflect the current settings.
function updateLeagueRootElements() {
  var leagueExe = leagueDirToExe(gSettings.leagueRoot);
  var elems = document.querySelectorAll("html /deep/ .leagueRoot");
  for (var i = 0; i < elems.length; ++i) {
    var elem = elems[i];
    elem.files = new window.FileList();
    elem.files.clear();
    elem.files.append(new window.File(leagueExe, leagueExe));
  }
}

function leagueExeToDir(exe) {
  if (OS.platform().toLowerCase().startsWith("win")) {
    return Path.dirname(exe);
  } else {
    return Path.join(exe, "Contents", "LOL");
  }
}

function leagueDirToExe(dir) {
  if (OS.platform().toLowerCase().startsWith("win")) {
    return Path.join(dir, "lol.launcher.exe");
  } else {
    return Path.join(dir, "..", "..");
  }
}

exports.init = init;
exports.getLeagueRoot = function() { return gSettings.leagueRoot; }
exports.getCurrentChampion = function() { return gSettings.currentChampion; }
exports.isFirstRun = function() { return gSettings.firstRun; }
exports.clearFirstRun =
    function() { delete gSettings.firstRun; scheduleSave(); }
exports.onLeagueRootChanged = function(cb) { gOnLeagueRootChanged = cb; }
exports.itemPickerOpenOnFocus =
    function() { return gSettings.itemPickerOpenOnFocus; }
exports.setItemPickerOpenOnFocus =
    function(val) { gSettings.itemPickerOpenOnFocus = val; scheduleSave(); }
