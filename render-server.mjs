import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const clientDir = resolve(root, "dist/client");
const serverBuildPath = new URL("./dist/server/server.js", import.meta.url);
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

let serverEntryPromise;

function getServerEntry() {
  serverEntryPromise ??= import(serverBuildPath.href).then((module) => module.default);
  return serverEntryPromise;
}

function staticFilePath(pathname) {
  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }

  const normalizedPath = normalize(decodedPathname).replace(/^([/\\])+/, "");
  const filePath = resolve(join(clientDir, normalizedPath));
  const clientRoot = clientDir.endsWith(sep) ? clientDir : `${clientDir}${sep}`;

  if (filePath !== clientDir && !filePath.startsWith(clientRoot)) {
    return undefined;
  }

  if (!existsSync(filePath)) return undefined;
  const stat = statSync(filePath);
  return stat.isFile() ? { filePath, stat } : undefined;
}

function serveStatic(req, res, pathname) {
  const file = staticFilePath(pathname);
  if (!file) return false;

  const contentType = mimeTypes.get(extname(file.filePath).toLowerCase()) || "application/octet-stream";
  const cacheControl = pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=3600";

  res.writeHead(200, {
    "Cache-Control": cacheControl,
    "Content-Length": file.stat.size,
    "Content-Type": contentType,
  });

  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  createReadStream(file.filePath).pipe(res);
  return true;
}

function requestBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  return Readable.toWeb(req);
}

function createWebRequest(req) {
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const hostHeader = req.headers.host || `127.0.0.1:${port}`;
  const url = new URL(req.url || "/", `${protocol}://${hostHeader}`);
  const body = requestBody(req);

  return new Request(url, {
    body,
    duplex: body ? "half" : undefined,
    headers: req.headers,
    method: req.method,
  });
}

async function sendWebResponse(webResponse, res) {
  res.writeHead(webResponse.status, Object.fromEntries(webResponse.headers));

  if (!webResponse.body) {
    res.end();
    return;
  }

  Readable.fromWeb(webResponse.body).pipe(res);
}

const nodeServer = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (serveStatic(req, res, url.pathname)) return;

    const serverEntry = await getServerEntry();
    const webResponse = await serverEntry.fetch(createWebRequest(req), process.env, {});
    await sendWebResponse(webResponse, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end("Internal Server Error");
  }
});

nodeServer.listen(port, host, () => {
  console.log(`CalmCampus listening on http://${host}:${port}`);
});
