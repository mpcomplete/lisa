var FS = require("fs");
var compareVersion = require("compare-version");
var Net = require("./net.js");
var Package = require("../../package.json");
var SwfExtractor = require("./swfExtractor.js");
var Async = require("./async.js");

var kPackageZip = "Lisa-appdata.zip";
var kLatestUrl =
    "https://raw.githubusercontent.com/mpcomplete/lisa/master/LATEST";
var kUpdateUrl =
    "https://github.com/mpcomplete/lisa/releases/download/{{VERSION}}/"
    + kPackageZip;
var gTemplate;

function init() {
  gTemplate = document.querySelector("template");
  gTemplate.version = {version: Package.version, needs: "check"};
  gTemplate.versionCheckTapped = Async.cb(checkVersion);
  gTemplate.versionUpdateTapped = Async.cb(updateVersion);
  gTemplate.versionRestartTapped = Async.cb(restartVersion);
}

function* checkVersion() {
  window.setUIDisabled(true);

  try {
    var newVersion = yield Net.fetchUrl(kLatestUrl);
    newVersion = newVersion.trim();
    if (compareVersion(Package.version, newVersion) < 0) {
      gTemplate.version.updateUrl = getUpdateUrl(newVersion);
      gTemplate.version.updateMessage =
          "(version " + newVersion + " available)";
      gTemplate.version.needs = "update";
    } else {
      delete gTemplate.version.needs;
    }
  } catch(e) {
    window.toast("Failed checking for updates: " + e, e);
  };

  window.setUIDisabled(false);
}

function* updateVersion() {
  window.setUIDisabled(true);

  var response = yield Net.get(gTemplate.version.updateUrl);

  try {
    response.pipe(FS.createWriteStream(kPackageZip))
        .on("finish", function() {
          window.toast("New version downloaded.");
          window.setUIDisabled(false);
          gTemplate.version.needs = "restart";
        })
        .on("error", function(e) {
          window.toast("Failed saving update: " + e, e);
          window.setUIDisabled(false);
        });
  } catch(e) {
    window.toast("Failed fetching update: " + e, e);
    window.setUIDisabled(false);
  };
}

function* restartVersion() {
  yield SwfExtractor.markDirty();
  window.location = "launcher.html";
}

function getUpdateUrl(version) {
  return kUpdateUrl.replace("{{VERSION}}", version);
}

exports.init = init;
