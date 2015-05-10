var Path = require("path");
var SWFRenderer = require("../third_party/SwfImgRenderer/index.js");
var SWFParser = require("../third_party/Gordon/parser.js");
var Settings = require("./settings.js");
var Async = require("./async.js");
var FS = Async.asyncifyNodeModule(require("fs"));

var kItemsDir;
var kDoneFile;

function* extract() {
  kItemsDir = window.userDataDir + "/ItemCache";
  kDoneFile = Path.join(kItemsDir, "_done.dat");

  var alreadyExtracted = yield prepareOutputDir();
  if (alreadyExtracted)
    return true;

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
  return true;
}

// Make sure our Image Cache exists. Returns true if we've already extracted
// all the images.
function* prepareOutputDir() {
  try {
    yield FS.accessAsync(kDoneFile);
    return true;
  } catch(e) { }

  try {
    yield FS.mkdirAsync(kItemsDir);
  } finally {
    return false;
  }
}

// Parse the SWF file, collecting all the objects and their names.
// Both arguments are out params.
function* parseSWF(swfObjects, idToName) {
  const caller = yield;

  var swfPath = getSWFPath();
  var swfData = yield FS.readFileAsync(swfPath);

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

// Mark the Image Cache as "finished".
function* finalizeOutputDir() {
  try {
    yield FS.writeFileAsync(kDoneFile, "true");
    return true;
  } catch(e) {
    throw new Error("Failed to write done file: " + e);
  }
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


function resolveItemPath(file) {
  // Our HTML runs in the context of the lib/ directory, so go up 1.
  return Path.join(kItemsDir, file);
}

function* markDirty() {
  const caller = yield;
  FS.unlink(kDoneFile, caller.success);
}

exports.extract = extract;
exports.resolveItemPath = resolveItemPath;
exports.markDirty = markDirty;
