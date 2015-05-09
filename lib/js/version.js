var FS = require("fs");
var compareVersion = require("compare-version");
var Net = require("./net.js");
var Package = require("../../package.json");
var SwfExtractor = require("./swfExtractor.js");
var Async = require("./async.js");

var kPackageZip = "Lisa-appdata.zip";
var kBaseUrl = "https://raw.githubusercontent.com/mpcomplete/lisa/master/";
var kUpdateUrl =
    "https://github.com/mpcomplete/lisa/releases/download/{{VERSION}}/"
    + kPackageZip;
var gTemplate;

function init() {
  gTemplate = document.querySelector("template");
  gTemplate.version = {version: Package.version, needs: "check"};
  gTemplate.versionCheckTapped = checkVersion;
  gTemplate.versionUpdateTapped = updateVersion;
  gTemplate.versionRestartTapped = Async.cb(restartVersion);
}

function checkVersion() {
  window.setUIDisabled(true);

  Net.fetchUrl(kBaseUrl + "LATEST").then(function(newVersion) {
    newVersion = newVersion.trim();
    if (compareVersion(Package.version, newVersion) < 0) {
      gTemplate.version.updateUrl = getUpdateUrl(newVersion);
      gTemplate.version.updateMessage =
          "(version " + newVersion + " available)";
      gTemplate.version.needs = "update";
    } else {
      delete gTemplate.version.needs;
    }
  }).catch(function(e) {
    window.toast("Failed checking for updates: " + e, e);
  }).then(function() {
    window.setUIDisabled(false);
  });
}

function updateVersion() {
  window.setUIDisabled(true);

  Net.get(gTemplate.version.updateUrl).then(function(response) {
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
  }).catch(function(e) {
    window.toast("Failed fetching update: " + e, e);
    window.setUIDisabled(false);
  });
}

function* restartVersion() {
  yield SwfExtractor.markDirty();
  window.location = "launcher.html";
}

function getUpdateUrl(version) {
  return kUpdateUrl.replace("{{VERSION}}", version);
}

exports.init = init;
