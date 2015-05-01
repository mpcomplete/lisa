var ItemTable = require("./itemTable.js");

function newItemSet() {
  return {
    "isGlobalForMaps" : true,
    "isGlobalForChampions" : false,
    "sortrank" : 0,  // TODO: what is this?
    "mode" : "any",
    "map" : "any",
    "associatedChampions" : [],
    "associatedMaps" : [],
    "type" : "custom",
    "priority" : false,
    "title" : "New Build",
    "uid" : generateUUID(),
    "blocks" : [
  //    {
  //      "items" : [
  //        {"id" : "1055", "count" : 1},
  //      ],
  //      "type" : "Section title"
  //    },
    ],
  };
}

// Given a parsed itemSet from mobafire or the like, create a list of itemSets
// in the League-readable format.
function itemSetFromParsed(parsed) {
  var itemSet = newItemSet();
  itemSet.title = parsed.name;
  itemSet.uid = generateUUID();
  itemSet.blocks = [];

  addSkillBlocks(itemSet, parsed);

  for (var i = 0; i < parsed.blocks.length; ++i) {
    itemSet.blocks.push(blockFromParsed(parsed.blocks[i]));
  }

  return itemSet;
}

function addSkillBlocks(itemSet, parsed) {
  var skills = parsed.skills;
  if (!Array.isArray(skills))
    skills = [skills];

  skills.forEach(function(skill) {
    var title = (skill.title ? skill.title + " " : "") + "Skill Order: ";
    itemSet.blocks.push({
        type: title + simplifySkillOrder(skill.skills),
        items: [
          itemFromName("Health Potion"),
          itemFromName("Mana Potion"),
          itemFromName("Stealth Ward"),
          itemFromName("Vision Ward"),
        ]
    });
  });
}

function blockFromParsed(parsed) {
  var block = {items: []};
  block.type = parsed.name;

  for (var i = 0; i < parsed.items.length; ++i) {
    block.items.push(itemFromName(parsed.items[i]));
  }

  return block;
}

function itemFromName(name) {
  item = {count: 1, id: ItemTable.nameToID(name).toString()};
  if (item.id == 0) item.name = name;
  return item;
}

function simplifySkillOrder(parsed) {
  if (!parsed)
    return "Unknown";

  var skillLetters = ['Q', 'W', 'E', 'R'];
  var max, maxNext;
  skillLetters.forEach(function(letter) {
    var index = parsed.lastIndexOf(letter);

    // At level 10, you should've maxed your first skill.
    if (index < 9)
      max = letter;
    // At level 14, you should've maxed your second skill.
    else if (index < 13)
      maxNext = letter;
  });

  if (max && maxNext) {
    var start = parsed.slice(0, 4).join("");
    if (start[3] == max)
      start = start.slice(0, 3);
    return "Start " + start + ", max " + max + maxNext;
  }
  return parsed.join("");
}

// Generates a UID that league needs for some reason.
function generateUUID() {
  var d = new Date().getTime();
  var uuid = 'LOL_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (d + Math.random()*16)%16 | 0;
    d = Math.floor(d/16);
    return (c=='x' ? r : (r&0x3|0x8)).toString(16).toUpperCase();
  });
  return uuid;
};

exports.newItemSet = newItemSet;
exports.itemSetFromParsed = itemSetFromParsed;
