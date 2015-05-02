var FS = require("fs");
var Path = require("path");
var SWFRenderer = require("../third_party/SwfImgRenderer/index.js");
var SWFParser = require("../third_party/Gordon/parser.js");
var Settings = require("./settings.js");

var kItemsDir;
var kDoneFile;

function extract() {
  kItemsDir = window.userDataDir + "/ItemCache";
  kDoneFile = Path.join(kItemsDir, "_done.dat");

  return prepareOutputDir().then(function(alreadyExtracted) {
    if (alreadyExtracted)
      return;

    return new Promise(function(resolve, reject) {
      FS.readFile(getSWFPath(), function(err, swfData) {
        if (err) return reject(err);

        var parser = new SWFParser();
        var swfObjects = [];
        var idToName = {};
        parser.parse(getSWFPath(), swfData, function(swfObject) {
          if (swfObject.type == "image") {
            swfObjects[swfObject.id] = swfObject;
          } else if (swfObject.symbolClasses) {
            for (var name in swfObject.symbolClasses)
              idToName[swfObject.symbolClasses[name]] = name;
          }
        }, function(err) {
          if (err) return reject(err);

          var swfRenderer = new SWFRenderer();
          var promises = [];
          for (var i in swfObjects) {
            var swfObject = swfObjects[i];
            promises.push(new Promise(function(resolve) {
              swfRenderer.render(swfObject, function(obj, png) {
                var tagName = idToName[obj.id];
                var match = /ImagePack_items_Embeds__e_([0-9]+)_(.*)/.exec(tagName);
                var name = match ? match[2] : "Unnamed";
                var path = Path.join(kItemsDir, name + "_i" + obj.id + ".png");
                FS.writeFile(path, png, function(err) {
                  if (err) {
                    console.warn("Failed to save: ", path, ": ", err);
                    reject(err);
                  }
                  resolve();
                });
              });
            }));
          }
          Promise.all(promises).then(resolve, reject);
        });
      });
    })
    .then(finalizeOutputDir)
    .then(function() {
      console.log("Success extracting images from SWF");
    });
  });
}

function getSWFPath() {
  var path = Path.join(Settings.getLeagueRoot(),
      "RADS/projects/lol_air_client/releases/");
  var version = "0.0.1.140";
  var versions = FS.readdirSync(path);
  for (var i in versions) {
    if (/^[0-9]+\.[0-9]+/.exec(versions[i]))
      version = versions[i];
  }
  path = Path.join(path, version);
  path = Path.join(path, "deploy/assets/imagePacks/ImagePack_items.swf");
  return path;
}

function prepareOutputDir() {
  return new Promise(function(resolve, reject) {
    FS.access(kDoneFile, function(err) {
      if (!err) resolve(true);  // already extracted
      FS.mkdir(kItemsDir, function(err) {
        resolve(false);
      });
    });
  });
}

function finalizeOutputDir() {
  return new Promise(function(resolve, reject) {
    FS.writeFile(kDoneFile, "true", function(err) {
      if (err) return reject(new Error("Failed to write done file"));
      resolve();
    });
  });
}

function resolveItemPath(file) {
  // Our HTML runs in the context of the lib/ directory, so go up 1.
  return Path.join(kItemsDir, file);
}

function markDirty() {
  return new Promise(function(resolve) {
    FS.unlink(kDoneFile, resolve);
  });
}

exports.extract = extract;
exports.resolveItemPath = resolveItemPath;
exports.markDirty = markDirty;
