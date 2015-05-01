var Http = require("http");
var Https = require("https");

// Like http.get, but follows all redirects.
function get(url, cb, limit) {
  limit = limit || 0;
  var module = url.startsWith("https:") ? Https : Http;
  return module.get(url, function(response) {
    if (response.statusCode == 302) {
      if (limit < 10)
        return get(response.headers.location, cb, limit+1);
      console.error("Redirect limit reached while fetching " + url);
    }
    cb(response);
  })
}

// Fetch data from the given URL and return its data as a Buffer.
function fetchUrl(url) {
  return new Promise(function(resolve, reject) {
    get(url, function(response) {
      var content = "";
      response.on("data", function(data) { content += data; });
      response.on("end", function() {
        if (response.statusCode >= 400)
          return reject("Server responded: " + response.statusCode + " " + response.statusMessage);
        resolve(content);
      });
    }).on("error", reject);
  });
};

exports.get = get;
exports.fetchUrl = fetchUrl;
