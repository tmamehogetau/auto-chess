import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const defaultEntryPath = "/src/client/index.html";
const port = Number.parseInt(process.env.CLIENT_CHECK_PORT ?? "8080", 10);

const contentTypeByExtension = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method Not Allowed");
    return;
  }

  const requestUrl = new URL(request.url ?? "/", "http://localhost");
  const pathname = requestUrl.pathname === "/" ? defaultEntryPath : requestUrl.pathname;
  const normalizedPath = normalize(pathname).replace(/^\\+/, "");

  if (normalizedPath.includes("..")) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad Request");
    return;
  }

  const absolutePath = join(projectRoot, normalizedPath);

  try {
    const fileBuffer = await readFile(absolutePath);
    const extension = extname(absolutePath).toLowerCase();
    const contentType =
      contentTypeByExtension[extension] ?? "application/octet-stream";

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentType,
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    response.end(fileBuffer);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found");
  }
});

server.listen(port, () => {
  const baseUrl = `http://localhost:${port}`;
  const entryUrl = `${baseUrl}${defaultEntryPath}`;
  const sampleUrl = `${entryUrl}?endpoint=ws://localhost:2567&roomName=game&setId=set2&autoconnect=1`;

  console.log(`[client-check] serving: ${entryUrl}`);
  console.log(`[client-check] sample : ${sampleUrl}`);
});
