var Url = require("url");
var Net = require("./net.js");

var kErrorMessage = "Page at URL doesn't look like a champion.gg build guide.";

// Set to false to have "Most Frequent" and "Highest Win %" be separate itemset
// pages.
var kMergeBuilds = true;

// Parse the given HTML document from champion.gg into a list of builds.
// Output format is an object. See mobafire.js for object format.
function parse(url) {
  return Net.fetchDocument(url)
    .then(fetchOtherRoles.bind(null, url))
    .then(function(docs) {
      var parsed = {builds: []};
      docs.forEach(function(doc) {
        parseRoot(doc, parsed);
      });
      return parsed;
    });
}

// Look for other roles and fetch the HTML Document for those.
function fetchOtherRoles(url, doc) {
  var otherRoles = querySelectorAll(doc,
      ".champion-profile li:not(.selected-role) a");
  var promises = [];
  for (var i = 0; i < otherRoles.length; ++i) {
    var href = otherRoles[i].attributes.href.value;
    var otherUrl = Url.resolve(url, href);
    promises.push(Net.fetchDocument(otherUrl));
  }

  return Promise.all(promises).then(function(docs) {
    docs.splice(0, 0, doc);
    return docs;
  });
}

// Toplevel parse function.
function parseRoot(root, parsed) {
  parsed.championName = querySelector(root,
      ".champion-profile h1").innerText.trim();

  var build = querySelectorAll(root, ".build-wrapper");
  var parsedBuild = parseBuild(build);
  parsedBuild.name = querySelector(root, ".selected-role h3").innerText.trim();
  parsed.builds.push(parsedBuild);

  try {
    var skills = querySelectorAll(root, ".skill-order");
    expect(skills, skills.length == 2);
    parsedBuild.skills = [ parseSkills(skills[0]), parseSkills(skills[1]) ];
  } catch(e) {
    console.warn("Couldn't parse skill section.", e);
  }
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

// Parse a single build page.
function parseBuild(roots) {
  var parsed = {name: "", blocks: []};

  var blocks = roots;
  for (var i = 0; i < blocks.length; ++i) {
    // Reverse the order so that Starters is first.
    var block = parseBlock(blocks[blocks.length - 1 - i]);
    // block.name looks like "Most Frequent Starters". Use first half for the
    // itemset title, second half for the itemblock title.
    if (i == 0)
      parsed.name = block.name.replace(" Starters", "");
    block.name = block.name.replace(parsed.name + " ", "");
    parsed.blocks.push(block);
  }

  return parsed;
}

// Parse 1 item block.
function parseBlock(root) {
  var parsed = {items: []};
  for (var h2 = root; h2 && h2.tagName != "H2"; h2 = h2.previousSibling)
    ;
  expect(root, h2);
  parsed.name = h2.innerText.trim();

  var items = querySelectorAll(root, "img");
  for (var i = 0; i < items.length; ++i) {
    var itemName = items[i].attributes.tooltip.value.trim();
    parsed.items.push(itemName);
  }
  return parsed;
}

// Parse the skills order.
function parseSkills(root) {
  var skills = querySelectorAll(root, ".skill");
  var skillLetter = "PQWER";  // 0 is the passive.
  var parsed = {skills: []};
  parsed.title =
      "(" + querySelector(root.parentNode, ".build-text").innerText.trim() + ")";

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

exports.parse = parse;
