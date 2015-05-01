var FS = require("fs");
var Path = require("path");
var ChampionTable = require("./championTable.js");
var Settings = require("./settings.js");

function saveChampion(champion) {
  try {
    var championDir = getChampionDir(champion.name, true);
    var promises = [];
    for (var i = 0; i < champion.itemSets.length; ++i) {
      var path = Path.join(championDir, "LISA_itemset_" + i + ".json");
      promises.push(saveItemSet(path, champion.itemSets[i]));
    }
    deleteItemSetsAbove(championDir, champion.itemSets.length);
    return Promise.all(promises).then(function() {
      champion._lisa_changed = false;
    });
  } catch(e) {
    return Promise.reject(e);
  }
}

// Writes a single |itemSet| to the given |path|.
function saveItemSet(path, itemSet) {
  return new Promise(function(resolve, reject) {
    var data = JSON.stringify(itemSet);
    FS.writeFile(path, data, function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

function loadChampion(championName) {
  return new Promise(function(resolve, reject) {
    var promises = [];
    var championDir = getChampionDir(championName);
    FS.readdir(championDir, function(err, files) {
      if (files) {
        files.forEach(function(file) {
          if (file.toLowerCase().startsWith("lisa_itemset_"))
            promises.push(loadItemSet(Path.join(championDir, file)));
        });
      }

      Promise.all(promises).then(function(itemSets) {
        var champion = {name: championName};
        champion.itemSets = itemSets;
        resolve(champion);
      }).catch(reject);
    });
  });
}

function loadItemSet(path) {
  return new Promise(function(resolve, reject) {
    FS.readFile(path, function(err, data) {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(data));
      } catch(e) {
        reject("Loading " + path + " failed: " + e);
      }
    });
  });
}

// Deletes all itemsets above (and including) |index|.
function deleteItemSetsAbove(dir, index) {
  FS.readdir(dir, function(err, files) {
    if (err) return;
    files.forEach(function(file) {
      var match = /LISA_itemset_([0-9]+).json/i.exec(file);
      if (match && match[1] >= index)
        FS.unlink(Path.join(dir, file));
    });
  });
}

function getChampionDir(championName, create) {
  var dir = Settings.getLeagueRoot();

  if (create) try { FS.mkdirSync(dir); } catch(e) {};
  dir = Path.join(dir, "Config");
  if (create) try { FS.mkdirSync(dir); } catch(e) {};
  dir = Path.join(dir, "Champions");
  if (create) try { FS.mkdirSync(dir); } catch(e) {};
  dir = Path.join(dir, ChampionTable.nameToDir(championName));
  if (create) try { FS.mkdirSync(dir); } catch(e) {};
  dir = Path.join(dir, "Recommended");
  if (create) try { FS.mkdirSync(dir); } catch(e) {};

  return dir;
}

exports.saveChampion = saveChampion;
exports.loadChampion = loadChampion;
