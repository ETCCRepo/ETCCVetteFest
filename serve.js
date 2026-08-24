// Tiny static server for local smoke-testing App/ETCCVetteFest.html.
// Not deployed and not part of the app — the real site is served by PHP.
var http = require("http"), fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "App");
http.createServer(function (req, res) {
  var p = req.url === "/" ? "/ETCCVetteFest.html" : req.url.split("?")[0];
  var f = path.join(ROOT, p);
  fs.readFile(f, function (err, buf) {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "Content-Type": p.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
    res.end(buf);
  });
}).listen(8129, function () { console.log("serving App/ on http://localhost:8129"); });
