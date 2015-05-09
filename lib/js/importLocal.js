var FS = require("fs");
var Path = require("path");
var Unzip = require("unzip");
var ChampionTable = require("./championTable.js");
var Settings = require("./settings.js");
var Async = require("./async.js");

function* importZipFile(path) {
  const caller = yield;
  var generators = [];
  FS.createReadStream(path)
      .on("error", caller.failure)
      .pipe(Unzip.Parse())
      .on("error", caller.failure)
      .on("entry",  function(entry) {
        var generator = handleZipEntry(entry);
        if (generator) generators.push(generator);
        else entry.autodrain();
      })
      .on("close", function(x) {
        Async.call(function*() {
          try {
            var results = yield generators;
            var champions = {};
            results.forEach(function(result) {
              var name = result.name;
              if (!champions[name])
                champions[name] = {name: name, itemSets: []};
              champions[name].itemSets.push(result.itemSet);
            });
            caller.success(champions);
          } catch(e) { caller.failure(e); }
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

  var json;
  entry.on("finish", function() {
    json = entry.read().toString();
  });
  return (function*() {
    const caller = yield;
    if (!json) json = entry.read().toString();
    caller.success({name: name, itemSet: JSON.parse(json)});
  })();
}

function* importClient() {
  try {
    var dir = Path.join(Settings.getLeagueRoot(), "Config", "Champions");

    var result = yield (function*() {
      const caller = yield;
      // Get all the champion directories.
      FS.readdir(dir, function(err, files) {
        if (err) return caller.failure(err);
        caller.success({files: files});
      });
    })();

    // Get all the itemset.json files.
    var generators = [];
    result.files.forEach(function(championDir) {
      var itemSetDir = Path.join(dir, championDir, "Recommended");
      generators.push((function*() {
        const caller = yield;
        FS.readdir(itemSetDir, function(err, files) {
          if (err) return caller.failure(err);
          caller.success({championName: ChampionTable.dirToName(championDir),
                          itemSetDir: itemSetDir,
                          files: files});
        });
      })());
    });

    var results = yield generators;

    // Read all the itemset.json files.
    var generators = [];
    results.forEach(function(result) {
      result.files.forEach(function(file) {
        if (!file.toLowerCase().startsWith("riot_itemset_")) return;
        generators.push((function*(result) {
          const caller = yield;

          FS.readFile(Path.join(result.itemSetDir, file), function(err, data) {
            if (err) return caller.failure(err);
            caller.success({
              championName: result.championName,
              itemSet: JSON.parse(data)
            });
          });
        })(result));
      });
    });

    // Combine the results into a single map.
    var results = yield generators;
    var champions = {};

    results.forEach(function(result) {
      var name = result.championName;
      if (!champions[name])
        champions[name] = {name: name, itemSets: []};
      champions[name].itemSets.push(result.itemSet);
    });

    return champions;
  } catch(e) {
    window.toast("Import failed: " + e, e);
  };
}

exports.importZipFile = importZipFile;
exports.importClient = importClient;
