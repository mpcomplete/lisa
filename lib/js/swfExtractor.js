var FS = require("fs");
var Path = require("path");
var SWFRenderer = require("../third_party/SwfImgRenderer/index.js");
var SWFParser = require("../third_party/Gordon/parser.js");
var Settings = require("./settings.js");
var Async = require("./async.js");

var kItemsDir;
var kDoneFile;

function extract() {
  return Async.toPromise(extractGen());
}

function* extractGen() {
  kItemsDir = window.userDataDir + "/ItemCache";
  kDoneFile = Path.join(kItemsDir, "_done.dat");

  const caller = yield;

  var alreadyExtracted = yield prepareOutputDir();
  if (alreadyExtracted)
    return caller.success();

  var swfObjects = [];
  var idToName = {};
  yield parseSWF(swfObjects, idToName);

  var swfRenderer = new SWFRenderer();
  var generators = [];
  swfObjects.forEach(function(swfObject) {
    generators.push(writeSWFObject(swfObject, swfRenderer, idToName));
  });
  yield generators;

  yield finalizeOutputDir();

  console.log("Success extracting images from SWF");
  caller.success();
}

// Parse the SWF file, collecting all the objects and their names.
// Both arguments are out params.
function* parseSWF(swfObjects, idToName) {
  const caller = yield;

  var swfPath = getSWFPath();
  FS.readFile(swfPath, function(err, swfData) {
    if (err) return caller.failure(err);

    var parser = new SWFParser();
    parser.parse(swfPath, swfData, function(swfObject) {
      if (swfObject.type == "image") {
        swfObjects[swfObject.id] = swfObject;
      } else if (swfObject.symbolClasses) {
        for (var name in swfObject.symbolClasses)
          idToName[swfObject.symbolClasses[name]] = name;
      }
    }, function(err) {
      if (err) return caller.failure(err);
      caller.success();
    });
  });
}

function* prepareOutputDir() {
  const caller = yield;
  FS.access(kDoneFile, function(err) {
    if (!err) return caller.success(true);  // already extracted
    FS.mkdir(kItemsDir, function(err) {
      caller.success(false);
    });
  });
}

// Write all the SWF objects out to PNG files.
function* writeSWFObject(swfObject, swfRenderer, idToName) {
  const caller = yield;
  swfRenderer.render(swfObject, function(obj, png) {
    var tagName = idToName[obj.id];
    var match = /ImagePack_items_Embeds__e_([0-9]+)_(.*)/.exec(tagName);
    var name = match ? match[2] : "Unnamed";
    var path = Path.join(kItemsDir, name + "_i" + obj.id + ".png");
    FS.writeFile(path, png, function(err) {
      if (err) {
        console.warn("Failed to save: ", path, ": ", err);
        return caller.failure(err);
      }
      caller.success();
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

function* finalizeOutputDir() {
  const caller = yield;
  FS.writeFile(kDoneFile, "true", function(err) {
    if (err) return caller.failure(new Error("Failed to write done file"));
    caller.success();
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
