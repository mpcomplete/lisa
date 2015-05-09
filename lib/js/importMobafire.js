var Net = require("./net.js");
var Async = require("./async.js");

var kErrorMessage = "Page at URL doesn't look like a mobafire build guide.";

// Parse the given HTML document from mobafire.com into a list of builds.
// Output format is an object:
// {
//   championName: championName,
//   builds: [
//     {
//       name: buildName,
//       skills: ['Q', 'E', 'W', 'Q', ...]
//       blocks: [
//         {
//           name: blockName,
//           items: [item1Name, item2Name, ...]
//         }, ...
//       ]
//     }, ...
//   ]
// }
function parse(url) {
  return Async.toPromise(parseGen(url));
}

function* parseGen(url) {
  var doc = yield Net.fetchDocument(url);
  return parseRoot(doc);
}

// Toplevel parse function.
function parseRoot(root) {
  var parsed = {builds: []};
  parsed.championName =
      querySelector(root, ".similar-builds-header .champ img").title.trim();

  var builds = querySelectorAll(root, ".build-box");
  for (var i = 0; i < builds.length; i++) {
    var build = parseBuild(builds[i]);
    parsed.builds.push(build);
  }
  return parsed;
}

// Parse a single build page.
function parseBuild(root) {
  var parsed = {blocks: []};
  parsed.name = querySelector(root, ".build-title h2").innerText.trim();

  var blocks = querySelectorAll(root, ".item-wrap");
  for (var i = 0; i < blocks.length; ++i) {
    var block = parseBlock(blocks[i]);
    parsed.blocks.push(block);
  }

  try {
    parsed.skills = {skills: parseSkills(root)};
  } catch(e) {
    console.warn("Couldn't parse skill section.", e);
  }

  return parsed;
}

// Parse 1 item block.
function parseBlock(root) {
  var parsed = {items: []};
  parsed.name = querySelector(root, "h2").innerText.trim();

  var items = querySelectorAll(root, ".item-title");
  for (var i = 0; i < items.length; ++i) {
    var itemName = items[i].innerText.trim();
    parsed.items.push(itemName);
  }
  return parsed;
}

// Parse the skills order.
function parseSkills(root) {
  var skills = querySelectorAll(root, ".ability-row");
  var skillLetter = "PQWER";  // 0 is the passive.
  var parsed = [];
  for (var i = 1; i <= 4; i++) {
    var skill = querySelectorAll(skills[i], ".ability-check");
    expect(skill, skill.length == 18);
    for (var j = 0; j < 18; j++) {
      if (skill[j].className.search("selected") != -1) {
        if (parsed[j] != null)
          throw new Error("Skills: Multiple choices for level " + (j+1));
        parsed[j] = skillLetter[i];
      }
    }
  }
  return parsed;
}

function querySelector(root, selector) {
  var element = root.querySelector(selector);
  if (!element)
    throw new Error(kErrorMessage + " Missing " + selector + ".");
  return element;
}

function querySelectorAll(root, selector) {
  var elements = root.querySelectorAll(selector);
  if (elements.length == 0)
    throw new Error(kErrorMessage + " Missing " + selector + ".");
  return elements;
}

function expect(root, expr) {
  if (!expr)
    throw new Error(kErrorMessage + " Unexpected value for " + root.className);
}

exports.parse = parse;
