var Http = require("http");
var Https = require("https");

// Like http.get, but follows all redirects.
function get(url, limit) {
  limit = limit || 0;
  var module = url.startsWith("https:") ? Https : Http;
  return new Promise(function(resolve, reject) {
    module.get(url, function(response) {
      if (response.statusCode == 302) {
        if (limit < 10)
          return get(response.headers.location, limit+1).then(resolve, reject);
        return reject("Redirect limit reached");
      } else if (response.statusCode >= 400) {
        return reject("Server responded: " + response.statusCode + " " + response.statusMessage);
      }
      resolve(response);
    }).on("error", reject);
  });
}

// Fetch data from the given URL and return its data as a Buffer.
function fetchUrl(url) {
  return new Promise(function(resolve, reject) {
    get(url).then(function(response) {
      var content = "";
      response.on("data", function(data) { content += data; });
      response.on("end", function() {
        resolve(content);
      });
    }).catch(reject);
  });
}

// Fetch an HTML document from the given URL, parse it, and return its Document
// object.
function fetchDocument(url) {
  return fetchUrl(url).then(function(htmlStr) {
    var domParser = new window.DOMParser();
    return domParser.parseFromString(htmlStr, "text/html");
  });
}

exports.get = get;
exports.fetchUrl = fetchUrl;
exports.fetchDocument = fetchDocument;
