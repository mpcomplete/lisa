var FS = require("fs");
var Path = require("path");
var Unzip = require("unzip");
var ChampionTable = require("./championTable.js");
var Settings = require("./settings.js");

function importZipFile(path) {
  return new Promise(function(resolve, reject) {
    var promises = [];
    FS.createReadStream(path)
        .on("error", reject)
        .pipe(Unzip.Parse())
        .on("error", reject)
        .on("entry", function(entry) {
          var promise = handleZipEntry(entry);
          if (promise) promises.push(promise);
          else entry.autodrain();
        })
        .on("close", function(x) {
          Promise.all(promises).then(function(results) {
            var champions = {};
            results.forEach(function(result) {
              var name = result.name;
              if (!champions[name])
                champions[name] = {name: name, itemSets: []};
              champions[name].itemSets.push(result.itemSet);
            });
            resolve(champions);
          }).catch(reject);
        });
  });
}

function handleZipEntry(entry) {
  if (entry.type != "File") return;
  var match = /([^\/]*)\/Recommended/.exec(entry.path);
  if (!match) return;

  var name = ChampionTable.dirToName(match[1]);
  if (!name)
    return console.warn("Skipping unknown champion:", match[1]);

  return new Promise(function(resolve, reject) {
    entry.on("finish", function() {
      var json = entry.read().toString();
      resolve({name: name, itemSet: JSON.parse(json)});
    });
  });
}

function importClient() {
  var dir = Path.join(Settings.getLeagueRoot(), "Config", "Champions");

  return new Promise(function(resolve, reject) {
    // Get all the champion directories.
    FS.readdir(dir, function(err, files) {
      if (err) return reject(err);
      resolve({dir: dir, files: files});
    });
  }).then(function(result) {
    // Get all the itemset.json files.
    var promises = [];

    result.files.forEach(function(championDir) {
      var itemSetDir = Path.join(result.dir, championDir, "Recommended");
      promises.push(new Promise(function(resolve, reject) {

        FS.readdir(itemSetDir, function(err, files) {
          if (err) return reject(err);
          resolve({championName: ChampionTable.dirToName(championDir),
                   itemSetDir: itemSetDir,
                   files: files});
        });
      }));
    });

    return Promise.all(promises);
  }).then(function(results) {
    // Read all the itemset.json files.
    var promises = [];

    results.forEach(function(result) {
      result.files.forEach(function(file) {
        if (file.toLowerCase().startsWith("lisa_itemset_")) return;
        promises.push(new Promise(function(resolve, reject) {

          var thingy = result;
          FS.readFile(Path.join(result.itemSetDir, file), function(err, data) {
            if (err) return reject(err);
            resolve({
              championName: thingy.championName,
              itemSet: JSON.parse(data)
            });
          });
        }));
      });
    });
    return Promise.all(promises);
  }).then(function(results) {
    // Combine the results into a single map.
    var champions = {}

    results.forEach(function(result) {
      var name = result.championName;
      if (!champions[name])
        champions[name] = {name: name, itemSets: []};
      champions[name].itemSets.push(result.itemSet);
    });

    return champions;
  }).catch(function(e) {
    window.toast("Import failed: " + e, e);
  });
}

exports.importZipFile = importZipFile;
exports.importClient = importClient;
