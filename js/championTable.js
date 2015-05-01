var championMap = require("./championTable.json");

function init(map) {
  championList = [];
  dirToNameMap = {};
  for (var name in championMap) {
    dirToNameMap[championMap[name].toLowerCase()] = name;
    championList.push({name: name, dir: championMap[name]});
  }
}
init(championMap);

function nameToDir(name) {
  return championMap[name];
}

function dirToName(dir) {
  return dirToNameMap[dir.toLowerCase()];
}

function getChampionList() {
  return championList;
}

exports.nameToDir = nameToDir;
exports.dirToName = dirToName;
exports.getChampionList = getChampionList;
