var FS = require("fs");
var compareVersion = require("compare-version");
var Net = require("./net.js");
var Package = require("../package.json");
var SwfExtractor = require("./swfExtractor.js");

var kBaseUrl = "https://raw.githubusercontent.com/mpcomplete/lisa/master/";
var kUpdateUrl = "https://github.com/mpcomplete/lisa/releases/download/0.1.0/Lisa-appdata.zip";
var kPackageZip = "Lisa-appdata.zip";
var gTemplate;

function init() {
  gTemplate = document.querySelector("template");
  gTemplate.version = {version: Package.version, needs: "check"};
  gTemplate.versionCheckTapped = checkVersion;
  gTemplate.versionUpdateTapped = updateVersion;
  gTemplate.versionRestartTapped = restartVersion;
}

function checkVersion() {
  window.setUIDisabled(true);

  Net.fetchUrl(kBaseUrl + "LATEST").then(function(newVersion) {
    newVersion = "1.0.0";
    if (compareVersion(Package.version, newVersion) < 0) {
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

  Net.get(kUpdateUrl, function(response) {
    window.response = response;
    response.pipe(FS.createWriteStream(kPackageZip))
        .on("finish", function() {
          window.toast("New version downloaded.");
          window.setUIDisabled(false);
          gTemplate.version.needs = "restart";
        })
        .on("error", function(e) {
          window.toast("Failed fetching new version: " + e, e);
          window.setUIDisabled(false);
        });
  });
}

function restartVersion() {
  SwfExtractor.markDirty().then(function() {
    window.location = "launcher.html";
  });
}

function updateFile(file) {
  return Net.fetchUrl(kBaseUrl + file).then(function(content) {
    return new Promise(function(resolve, reject) {
      FS.writeFile("./" + file, content, function(err) {
        if (err) return reject(e);
        resolve();
      });
    });
  });
}

exports.init = init;
