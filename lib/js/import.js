var FS = require("fs");
var Url = require("url");
var Net = require("./net.js");
var ImportLocal = require("./importLocal.js");
var ImportMobafire = require("./importMobafire.js");
var ImportChampiongg = require("./importChampiongg.js");
var OutputFormat = require("./outputFormat.js");
var Async = require("./async.js");

var gTemplate;

function init() {
  gTemplate = document.querySelector("template");

  var importUrl = document.querySelector("#import-url");
  importUrl.onkeypress = function(e) {
    if (!(e && e.which == 13)) return;
    gTemplate.importUrlTapped();
  };
  gTemplate.importTapped = function() {
    var clipText = window.Gui.Clipboard.get().get("text");
    if (clipText && clipText.length > 0)
      importUrl.value = clipText;
    importDialog = document.querySelector("#import-dialog");
    importDialog.open();
  };
  gTemplate.importUrlTapped = Async.cb(function*() {
    yield importFromUrl(importUrl.value);
  });
  gTemplate.importFileTapped = Async.cb(function*() {
    var elem = document.querySelector("html /deep/ #import-file");
    yield importImpl(ImportLocal.importZipFile(elem.value));
  });
  gTemplate.importClientTapped = Async.cb(function*() {
    yield importImpl(ImportLocal.importClient());
  });

  document.querySelectorAll("#import-dialog a").array().forEach(function(a) {
    a.onclick = function() {
      window.Gui.Shell.openExternal(a.href);
      return false;
    };
  });
}

// Import a champion build page from the given URL.
function* importFromUrl(url) {
  var importer;
  if (Url.parse(url).hostname.endsWith("mobafire.com")) {
    importer = ImportMobafire.parse(url);
  } else if (Url.parse(url).hostname.endsWith("champion.gg")) {
    importer = ImportChampiongg.parse(url);
  } else {
    return window.toast("Can only import builds from mobafire.com and champion.gg.");
  }

  yield importImpl(importer, true);
}

function* importImpl(importer, isSingleParser) {
  var importDialog = document.querySelector("html /deep/ #import-dialog");
  window.setUIDisabled(true);

  try {
    // TODO: unify these two paths.
    if (isSingleParser) {
      var parsed = yield importer;
      yield window.selectChampion(parsed.championName, false);
      parsed.builds.forEach(function(p) {
        gTemplate.champion.itemSets.push(OutputFormat.itemSetFromParsed(p));
      });
      validateItems();
    } else {
      var champions = yield importer;
      var generators = [];
      for (var name in champions) {
        generators.push(function*(name) {
          var champion = yield window.loadChampion(name);
          champions[champion.name].itemSets.forEach(function(itemset) {
            champion.itemSets.push(itemset);
          });
          return true;
        }(name));
      }
      yield generators;
    }

    importDialog.close();
    window.toast("Imported.");
  } catch(e) {
    window.toast("Import failed: " + e, e);
  }

  window.setUIDisabled(false);
}

function validateItems() {
  var invalidItem;
  var valid = gTemplate.openChampions.every(function(champion) {
    return champion.itemSets.every(function(itemSet) {
      return itemSet.blocks.every(function(block) {
        return block.items.every(function(item) {
          if (item.id == 0) {
            invalidItem = item.name;
            return false;
          }
          return true;
        });
      });
    });
  });

  if (!valid)
    window.toast("Warning: Unrecognized item: " + invalidItem + ". Please update the app in Settings.");
}

function setDialogDisabled(dialog, disabled) {
  dialog.querySelectorAll("input, paper-button").array().forEach(function(e) {
    e.disabled = disabled;
  });
}

exports.init = init;
