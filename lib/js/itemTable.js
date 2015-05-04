var SwfExtractor = require("./swfExtractor.js");
var itemMap = require("./itemTable.json");
var kUnknown = 0;

function init(map) {
  itemMap = map;
  delete itemMap.comment;

  itemList = [];
  idToPathMap = {};
  for (var name in itemMap) {
    var value = itemMap[name];
    itemList.push({name: name, id: value.id, path: value.path});
    idToPathMap[value.id] = value.path;
  }
}
init(itemMap);

function nameToID(name) {
  var entry = itemMap[name];
  return entry ? entry.id : kUnknown;
}

function idToImage(id) {
  if (id == 0)
    return "../images/unknown.png";
  return SwfExtractor.resolveItemPath(idToPathMap[id]);
}

function getItemList() {
  return itemList;
}

exports.nameToID = nameToID;
exports.idToImage = idToImage;
exports.getItemList = getItemList;
