var FS = require("fs");
var Url = require("url");
var Net = require("./net.js");
var ImportLocal = require("./importLocal.js");
var ImportMobafire = require("./importMobafire.js");
var ImportChampiongg = require("./importChampiongg.js");
var OutputFormat = require("./outputFormat.js");

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
  gTemplate.importUrlTapped = function() {
    importFromUrl(importUrl.value);
  };
  gTemplate.importFileTapped = function() {
    var elem = document.querySelector("html /deep/ #import-file");
    importImpl({file: elem.value, importer: ImportLocal.importZipFile});
  };
  gTemplate.importClientTapped = function() {
    importImpl({importer: ImportLocal.importClient});
  };

  document.querySelectorAll("#import-dialog a").array().forEach(function(a) {
    a.onclick = function() {
      window.Gui.Shell.openExternal(a.href);
      return false;
    };
  });
}

// Import a champion build page from the given URL.
function importFromUrl(url) {
  var importer;
  if (Url.parse(url).hostname.endsWith("mobafire.com")) {
    importer = ImportMobafire;
  } else if (Url.parse(url).hostname.endsWith("champion.gg")) {
    importer = ImportChampiongg;
  } else {
    return window.toast("Can only import builds from mobafire.com and champion.gg.");
  }

  importImpl({url: url, importer: importer});
}

function importImpl(arg) {
  var importDialog = document.querySelector("html /deep/ #import-dialog");
  window.setUIDisabled(true);

  var promise;
  if (arg.url) {
    promise = Net.fetchUrl(arg.url).then(function(htmlStr) {
      var domParser = new window.DOMParser();
      var htmlDoc = domParser.parseFromString(htmlStr, "text/html");
      var parsed = arg.importer.parse(htmlDoc);
      return window.selectChampion(parsed.championName, false).then(function() {
        parsed.builds.forEach(function(p) {
          gTemplate.champion.itemSets.push(OutputFormat.itemSetFromParsed(p));
        });
        validateItems();
      });
    });
  } else {
    promise = arg.importer(arg.file).then(function(champions) {
      var promises = [];
      for (var name in champions) {
        promises.push(window.loadChampion(name).then(function(champion) {
          champions[champion.name].itemSets.forEach(function(itemset) {
            champion.itemSets.push(itemset);
          });
        }));
      }
    });
  }
  promise.then(function() {
    importDialog.close();
    window.toast("Imported.");
  }).catch(function(e) {
    window.toast("Import failed: " + e, e);
  }).then(function() {
    window.setUIDisabled(false);
  });
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
