var Path = require("path");
var ChampionTable = require("./championTable.js");
var Settings = require("./settings.js");
var Async = require("./async.js");
var FS = Async.asyncifyNodeModule(require("fs"));

function* saveChampion(champion) {
  var championDir = getChampionDir(champion.name, true);
  var generators = [];

  ensureItemSetFilenames(champion);
  champion.itemSets.forEach(function(itemSet) {
    var path = Path.join(championDir, itemSet._lisa_filename);
    generators.push(saveItemSet(path, itemSet));
  });
  yield generators;

  deleteDeletedItemSets(championDir, champion);
  champion._lisa_changed = false;

  return true;
}

// Writes a single |itemSet| to the given |path|.
function* saveItemSet(path, itemSet) {
  const caller = yield;
  delete itemSet._lisa_filename;  // Don't write _lisa data.
  var data = JSON.stringify(itemSet);
  FS.writeFile(path, data, function(err) {
    itemSet._lisa_filename = Path.basename(path);
    if (err) return caller.failure(err);
    caller.success();
  });
}

function* loadChampion(championName) {
  var championDir = getChampionDir(championName);
  var files = yield FS.readdirAsync(championDir);
  var generators = [];
  (files || []).forEach(function(file) {
    if (!file.toLowerCase().startsWith("riot_itemset_"))
      generators.push(loadItemSet(Path.join(championDir, file)));
  });

  var itemSets = yield generators;
  var champion = {name: championName, itemSets: itemSets};
  return champion;
}

function* loadItemSet(path) {
  try {
    var data = yield FS.readFileAsync(path);
    var itemSet = JSON.parse(data);
    itemSet._lisa_filename = Path.basename(path);
    return itemSet;
  } catch(e) {
    throw new Error("Loading " + path + " failed: " + e);
  }
}

// Ensures that itemSet._lisa_filename is set and valid for every itemSet
// in |champion|.itemSets.
function ensureItemSetFilenames(champion) {
  // Find the highest index of all the LISA_itemset_<index>.json files.
  var highestIndex = -1;
  champion.itemSets.forEach(function(itemSet) {
    if (!itemSet._lisa_filename) return;
    var match = /LISA_itemset_([0-9]+).json/i.exec(itemSet._lisa_filename);
    if (match && match[1] > highestIndex)
      highestIndex = match[1];
  });

  // Dish out new filenames.
  var index = Number(highestIndex) + 1;
  champion.itemSets.forEach(function(itemSet) {
    if (itemSet._lisa_filename) return;
    itemSet._lisa_filename = "LISA_itemset_" + index + ".json";
    ++index;
  });
}

// Deletes the file for every itemSet deleted in the editor.
function deleteDeletedItemSets(championDir, champion) {
  if (!champion._lisa_deletedItemSets)
    return;

  champion._lisa_deletedItemSets.forEach(function(itemSet) {
    if (!itemSet._lisa_filename) return;
    FS.unlink(Path.join(championDir, itemSet._lisa_filename));
  });
  delete champion._lisa_deletedItemSets;
}

// Gets the champion's itemSet directory, optionally creating it if it doesn't
// exist.
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
