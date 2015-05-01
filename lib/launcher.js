var FS = require("fs");
var Unzip = require("unzip");

var kPackagePath = "./Lisa-appdata.zip";

// Unpack an update, if available, overwriting the contents of the current
// directory. When done (or on failure, after a pause), we navigate to the main
// page.
function maybeUnpack() {
  var promises = [];
  FS.createReadStream(kPackagePath)
      .on("error", function(e) {
        if (e.code == "ENOENT") return loadApp();
        fail(e);
      })
      .pipe(Unzip.Parse())
      .on("error", fail)
      .on("entry", function(entry) {
        if (promises.length == 0)
          message("Updating...");
        var promise = handleZipEntry(entry);
        if (promise) promises.push(promise);
        else entry.autodrain();
      })
      .on("close", function() {
        Promise.all(promises).then(function(results) {
          message("Update successful!");
          FS.unlink(kPackagePath, loadApp);
        }).catch(fail);
      });
}

// Unpack a single zip entry.
function handleZipEntry(entry) {
  if (entry.type == "Directory") {
    try { FS.mkdirSync(entry.path); } catch(e) {
      if (e.code != "EEXIST") return Promise.reject(e);
    }
    return Promise.resolve();
  }

  // else: file
  return new Promise(function(resolve, reject) {
    entry.pipe(FS.createWriteStream(entry.path))
       .on("error", reject)
       .on("close", resolve);
  });
}

function fail(e) {
  message("Update failed. Lisa may not work properly.", e);
  setTimeout(loadApp, 3000);
}

function loadApp() {
  window.location = "index.html";
}

function message(msg, e) {
  if (e) console.error(msg, e, e.stack);
  else console.log(msg);
  document.querySelector("#text").innerText = msg;
}

window.onerror = function(e) {
  fail(e);
};

maybeUnpack();
