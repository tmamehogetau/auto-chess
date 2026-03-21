const http = require("http");
const fs = require("fs");
const path = require("path");

const rootDir = process.argv[2];
const port = Number(process.argv[3] || 54321);
const host = process.argv[4] || "127.0.0.1";

if (!rootDir) {
  throw new Error("rootDir is required");
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const requestPath = req.url === "/" ? "/battle-start-options.html" : req.url;
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(rootDir, safePath);

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain; charset=utf-8" });
    res.end(contents);
  });
});

server.listen(port, host, () => {
  process.stdout.write(JSON.stringify({ type: "static-server-started", url: `http://${host}:${port}` }));
});
