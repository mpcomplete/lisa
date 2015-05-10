var Url = require("url");
var Net = require("./net.js");

var kErrorMessage = "Page at URL doesn't look like a champion.gg build guide.";

// Set to false to have "Most Frequent" and "Highest Win %" be separate itemset
// pages.
var kMergeBuilds = true;

// Download and parse the given HTML document from champion.gg into a list of
// builds. Output format is an object. See mobafire.js for object format.
function* importUrl(url) {
  var doc = yield Net.fetchDocument(url);
  var allDocs = yield fetchOtherRoles(url, doc);
  var parsed = {builds: []};
  allDocs.forEach(function(doc) {
    parseRoot(doc, parsed);
  });
  return parsed;
}

// Look for other roles and fetch the HTML Document for those.
function* fetchOtherRoles(url, doc) {
  try {
  var otherRoles = querySelectorAll(doc,
      ".champion-profile li:not(.selected-role) a");
  } catch(e) {
    return [doc];
  }
  var generators = [];
  for (var i = 0; i < otherRoles.length; ++i) {
    var href = otherRoles[i].attributes.href.value;
    var otherUrl = Url.resolve(url, href);
    generators.push(Net.fetchDocument(otherUrl));
  }

  var docs = yield generators;
  docs.splice(0, 0, doc);
  return docs;
}

// Toplevel parse function.
function parseRoot(root, parsed) {
  parsed.championName = querySelector(root,
      ".champion-profile h1").innerText.trim();
  parsed.builds.push(parseBuild(root));
}

// Parse a single build page.
function parseBuild(root) {
  var parsed = {blocks: []};
  parsed.name = querySelector(root, ".selected-role h3").innerText.trim();

  var blocks = querySelectorAll(root, ".build-wrapper");
  var headings = querySelectorAll(blocks[0].parentNode.parentNode, "h2");
  var buildTexts = querySelectorAll(blocks[0].parentNode.parentNode,
                                    ".build-text");
  expect(blocks[0], blocks.length == headings.length);
  expect(blocks[0], blocks.length == buildTexts.length);
  for (var i = 0; i < blocks.length; ++i) {
    // Reverse the order so that Starters is first.
    var index = blocks.length - 1 - i;
    var block = parseBlock(blocks[index], headings[index], buildTexts[index]);
    var len = parsed.blocks.push(block);

    // If the last 2 builds are equal, just drop the last one.
    if (len > 1 &&
        arraysEqual(parsed.blocks[len-1].items, parsed.blocks[len-2].items))
      parsed.blocks.splice(-1, 1);
  }

  try {
    var skills = querySelectorAll(root, ".skill-order");
    expect(skills, skills.length == 2);
    var buildTexts = querySelectorAll(skills[0].parentNode,
                                      ".skill-order ~ .build-text");
    expect(skills, buildTexts.length >= 2);
    parsed.skills = [
        parseSkills(skills[0], buildTexts[0]),
        parseSkills(skills[1], buildTexts[1]),
    ];
  } catch(e) {
    console.warn("Couldn't parse skill section.", e.stack);
  }

  return parsed;
}

// Parse 1 item block.
function parseBlock(root, heading, buildText) {
  var parsed = {items: []};
  parsed.name = translateBlockName(heading.innerText.trim())
      + " (" + buildText.innerText.trim() + ")";

  var items = querySelectorAll(root, "img");
  for (var i = 0; i < items.length; ++i) {
    var itemName = items[i].attributes.tooltip.value.trim();
    parsed.items.push(itemName);
  }
  return parsed;
}

// Parse the skills order.
function parseSkills(root, buildText) {
  var skills = querySelectorAll(root, ".skill");
  var skillLetter = "PQWER";  // 0 is the passive.
  var parsed = {skills: []};
  parsed.title = "{{order}} (" + buildText.innerText.trim() + ")";

  for (var i = 1; i <= 4; i++) {
    var skill = querySelectorAll(skills[i], ".skill-selections > div");
    expect(skill, skill.length == 18);
    for (var j = 0; j < 18; j++) {
      if (skill[j].className.search("selected") != -1) {
        if (parsed.skills[j] != null)
          throw new Error("Skills: Multiple choices for level " + (j+1));
        parsed.skills[j] = skillLetter[i];
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

function expect(root, expr, msg) {
  if (!expr) {
    throw new Error(kErrorMessage + " " +
        (msg || "Unexpected value for " + root.className));
  }
}

// Rename the item blocks using this mapping.
var kTranslateMap = {
  "Most Frequent Core Build": "Most Frequent Build",
  "Most Frequent Starters": "Most Frequent Starters",
  "Highest Win % Core Build": "Highest Win Rate Build",
  "Highest Win % Starters": "Highest Win Rate Starters",
};
function translateBlockName(name) {
  return kTranslateMap[name] || name;
}

// Returns true if the 2 arrays are equal.
function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length != b.length) return false;

  for (var i = 0; i < a.length; ++i)
    if (a[i] !== b[i]) return false;

  return true;
}


exports.importUrl = importUrl;
