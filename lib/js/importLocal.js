var Path = require("path");
var Unzip = require("unzip");
var ChampionTable = require("./championTable.js");
var Settings = require("./settings.js");
var Async = require("./async.js");
var FS = Async.asyncifyNodeModule(require("fs"));

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
      .on("close", Async.cb(function*() {
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
      }));
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

    // Get all the champion directories.
    var championDirs = yield FS.readdirAsync(dir);

    // Get all the itemset.json files.
    var generators = [];
    championDirs.forEach(function(championDir) {
      var itemSetDir = Path.join(dir, championDir, "Recommended");
      generators.push((function*() {
        const caller = yield;
        var files = yield FS.readdirAsync(itemSetDir);
        caller.success({championName: ChampionTable.dirToName(championDir),
                        itemSetDir: itemSetDir,
                        files: files});
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

          var data = yield FS.readFileAsync(Path.join(result.itemSetDir, file));
          caller.success({
            championName: result.championName,
            itemSet: JSON.parse(data)
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
