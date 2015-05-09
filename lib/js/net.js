var Http = require("http");
var Https = require("https");
var Async = require("./async.js");

// Like http.get, but follows all redirects.
function* get(url, limit) {
  const caller = yield;

  limit = limit || 0;
  var module = url.startsWith("https:") ? Https : Http;
  module.get(url, Async.cb(function*(response) {
    if (response.statusCode == 302) {
      try {
        if (limit > 10)
          throw new Error("Redirect limit reached");
        caller.success(yield get(response.headers.location, limit+1));
      } catch(e) {
        caller.failure(e);
      }
    } else if (response.statusCode >= 400) {
      return caller.failure("Server responded: " + response.statusCode
                            + " " + response.statusMessage);
    }
    caller.success(response);
  })).on("error", caller.failure);
}

// Fetch data from the given URL and return its data as a Buffer.
function* fetchUrl(url) {
  const caller = yield;

  var response = yield get(url);
  var content = "";
  response.on("data", function(data) { content += data; });
  response.on("end", function() {
    caller.success(content);
  });
}

// Fetch an HTML document from the given URL, parse it, and return its Document
// object.
function* fetchDocument(url) {
  var htmlStr = yield fetchUrl(url);
  var domParser = new window.DOMParser();
  return domParser.parseFromString(htmlStr, "text/html");
}

exports.get = get;
exports.fetchUrl = fetchUrl;
exports.fetchDocument = fetchDocument;
