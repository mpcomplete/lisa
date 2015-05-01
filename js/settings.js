var FS = require("fs");
var Path = require("path");
var SwfExtractor = require("./swfExtractor.js");

var kSettingsPath = "./UserData/settings.json";

var gSettings;
var gScheduleID;
var gTemplate;
var gOnLeagueRootChanged;

function init() {
  gSettings = {
    firstRun: true,
    currentChampion: "Udyr",
    leagueRoot: getDefaultLeagueRoot(),
    windowSize: {width: window.outerWidth, height: window.outerHeight},
    showItemNames: false,
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

      gSettings.leagueRoot = file.path;
      scheduleSave();
      onLeagueRootChanged().then(function() {
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

  return setupUserDataDir().then(load).then(function() {
    // Only resize if necessary. Also, resizing messes with the firstRun
    // dialog, so this fixes a bug.
    if (!gSettings.firstRun)
      window.resizeTo(gSettings.windowSize.width, gSettings.windowSize.height);

    gTemplate.settings = gSettings;
    return onLeagueRootChanged();
  }).catch(function(e) {
    console.log("Failed to finalize settings: ", e);
  });
}

function scheduleSave() {
  if (gScheduleID)
    window.clearTimeout(gScheduleID);
  gScheduleID = window.setTimeout(save, 1000);
}

function setupUserDataDir() {
  return new Promise(function(resolve) {
    FS.mkdir("./UserData", function(err) {
      if (err && err.code != "EEXIST")
        console.error("Couldn't create UserData dir:", err);
      resolve();
    });
  });
}

function save() {
  FS.writeFile(kSettingsPath, JSON.stringify(gSettings), function(err) {
    if (err) return console.error("Failed saving settings.");
    console.log("Settings saved.");
  });
}

function load() {
  return new Promise(function(resolve, reject) {
    FS.readFile(kSettingsPath, function(err, data) {
      if (err) reject(err);
      try {
        var loadedSettings = JSON.parse(data);
        if (loadedSettings.leagueRoot && loadedSettings.windowSize)
          gSettings = loadedSettings;
      } catch(e) {
        reject(e);
      }
      resolve();
    });
  }).catch(function(e) {
    console.warn("Failed to load settings: ", e);
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
  try { if (FS.statSync(dir).isDirectory()) return dir; } catch(e) {};
  var dir = "~/Applications/Leauge of Legends";
  try { if (FS.statSync(dir).isDirectory()) return dir; } catch(e) {};
  var dir = "./";
  return dir;
}

// Common tasks when the league root is updated.
function onLeagueRootChanged() {
  updateLeagueRootElements();
  return SwfExtractor.extract()
      .catch(function(err) {
        gSettings.showItemNames = true;
        console.log(gSettings);
        window.toast("Couldn't find item icons. Item images will be broken.",
                     err);
      })
      .then(validateLeagueRoot);
}

// Check our leagueRoot setting to see if it points to a valid League of Legends
// folder.
function validateLeagueRoot() {
  return new Promise(function(resolve) {
    FS.stat(gSettings.leagueRoot, function(err, stats) {
      gTemplate.leagueRootExists = (stats && stats.isDirectory());

      FS.stat(Path.join(gSettings.leagueRoot,
                        "RADS", "projects", "lol_air_client"),
                        function(err, stats) {
        gTemplate.leagueRootValid = (stats && stats.isDirectory());
        resolve();
      });
    });
  });
}

// Update our leagueRoot filepickers to reflect the current settings.
function updateLeagueRootElements() {
  var elems = document.querySelectorAll("html /deep/ .leagueRoot");
  for (var i = 0; i < elems.length; ++i) {
    var elem = elems[i];
    elem.files = new window.FileList();
    elem.files.clear();
    elem.files.append(
        new window.File(gSettings.leagueRoot, gSettings.leagueRoot));
  }
}

exports.init = init;
exports.getLeagueRoot = function() { return gSettings.leagueRoot; }
exports.getCurrentChampion = function() { return gSettings.currentChampion; }
exports.isFirstRun = function() { return gSettings.firstRun; }
exports.clearFirstRun = function() { delete gSettings.firstRun; scheduleSave(); }
exports.onLeagueRootChanged = function(cb) { gOnLeagueRootChanged = cb; }
