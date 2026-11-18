import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import net from "node:net";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JWT_SECRET, signRole } from "./keys.mjs";

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pgBin = "/opt/homebrew/opt/postgresql@14/bin";
const pgData = path.join(root, ".pgdata");
const stackDir = path.join(root, ".stack");
const mailDir = path.join(stackDir, "mail");
const binDir = path.join(root, ".bin");
const dbPort = 54322;
const apiPort = 54321;
const authPort = 9999;
const restPort = 54330;
const smtpPort = 54325;
const dbUrl = `postgres://postgres@127.0.0.1:${dbPort}/yalepaths?sslmode=disable&options=-csearch_path%3Dpublic,auth`;
const children = [];

function log(message) {
  console.log(`[stack] ${message}`);
}

async function command(bin, args, options = {}) {
  try {
    const result = await exec(bin, args, options);
    return result.stdout?.toString() ?? "";
  } catch (error) {
    const stderr = error.stderr?.toString() || error.message;
    throw new Error(`${bin} ${args.join(" ")} failed: ${stderr}`);
  }
}

function psqlArgs(database, extra = []) {
  return ["-h", "127.0.0.1", "-p", String(dbPort), "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", ...extra];
}

async function psql(database, sql) {
  return command(path.join(pgBin, "psql"), psqlArgs(database, ["-c", sql]), { env: process.env });
}

async function psqlFile(database, file) {
  return command(path.join(pgBin, "psql"), psqlArgs(database, ["-f", file]), { env: process.env });
}

function ensureLibpq() {
  const target = "/opt/homebrew/opt/libpq/lib/libpq.5.dylib";
  const source = "/opt/homebrew/opt/postgresql@15/lib/libpq.5.dylib";
  if (fs.existsSync(target) || !fs.existsSync(source)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(source, target);
}

async function stopPostgres() {
  if (!fs.existsSync(path.join(pgData, "PG_VERSION"))) return;
  await exec(path.join(pgBin, "pg_ctl"), ["-D", pgData, "stop", "-m", "fast"]).catch(() => {});
}

async function stopRecorded() {
  const pidFile = path.join(stackDir, "pids.json");
  if (fs.existsSync(pidFile)) {
    const pids = JSON.parse(fs.readFileSync(pidFile, "utf8"));
    if (pids.stack && pids.stack !== process.pid) {
      try {
        process.kill(pids.stack, "SIGTERM");
      } catch {
        /* already gone */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    for (const pid of [pids.auth, pids.rest].filter(Boolean)) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* already gone */
      }
    }
  }
  await stopPostgres();
}

async function ensureDatabase() {
  fs.mkdirSync(stackDir, { recursive: true });
  fs.mkdirSync(mailDir, { recursive: true });
  if (!fs.existsSync(path.join(pgBin, "initdb"))) {
    throw new Error("PostgreSQL 14 binaries were not found at /opt/homebrew/opt/postgresql@14.");
  }
  if (!fs.existsSync(path.join(pgData, "PG_VERSION"))) {
    log("creating a dedicated Postgres cluster on port 54322");
    await command(path.join(pgBin, "initdb"), [
      "-D",
      pgData,
      "-U",
      "postgres",
      "--auth-local=trust",
      "--auth-host=trust",
      "--encoding=UTF8",
      "--locale=C",
    ]);
  }
  const ready = await exec(path.join(pgBin, "pg_isready"), ["-h", "127.0.0.1", "-p", String(dbPort)]).then(
    () => true,
    () => false,
  );
  if (!ready) {
    await command(path.join(pgBin, "pg_ctl"), [
      "-D",
      pgData,
      "-l",
      path.join(stackDir, "postgres.log"),
      "-o",
      `-p ${dbPort} -k ${pgData} -c listen_addresses=127.0.0.1`,
      "start",
    ]);
  }
  const databases = await psql("postgres", "select datname from pg_database where datname = 'yalepaths'");
  if (!databases.includes("yalepaths")) {
    await psql("postgres", "create database yalepaths");
  }
  await psqlFile("yalepaths", path.join(root, "supabase/bootstrap/roles.sql"));
  await psql("yalepaths", "create extension if not exists pgcrypto");
}

function startProcess(name, commandName, args, env, cwd) {
  const logPath = path.join(stackDir, `${name}.log`);
  const output = fs.createWriteStream(logPath, { flags: "a" });
  const child = spawn(commandName, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(output);
  child.stderr.pipe(output);
  child.on("exit", (code) => {
    if (code && code !== 0) log(`${name} exited with ${code}. See .stack/${name}.log`);
  });
  children.push(child);
  return child;
}

function authEnv(hook) {
  const env = {
    ...process.env,
    GOTRUE_DB_DRIVER: "postgres",
    GOTRUE_DB_DATABASE_URL: dbUrl,
    DATABASE_URL: dbUrl,
    API_EXTERNAL_URL: `http://127.0.0.1:${apiPort}`,
    GOTRUE_API_EXTERNAL_URL: `http://127.0.0.1:${apiPort}`,
    GOTRUE_API_HOST: "127.0.0.1",
    GOTRUE_API_PORT: String(authPort),
    PORT: String(authPort),
    GOTRUE_SITE_URL: "http://localhost:3000",
    GOTRUE_URI_ALLOW_LIST: "http://localhost:3000,http://127.0.0.1:3000",
    GOTRUE_JWT_SECRET: JWT_SECRET,
    GOTRUE_JWT_EXP: "3600",
    GOTRUE_JWT_AUD: "authenticated",
    GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
    GOTRUE_JWT_ADMIN_ROLES: "service_role",
    GOTRUE_DISABLE_SIGNUP: "false",
    GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
    GOTRUE_EXTERNAL_PHONE_ENABLED: "false",
    GOTRUE_MAILER_AUTOCONFIRM: "false",
    GOTRUE_MAILER_OTP_EXP: "3600",
    GOTRUE_MAILER_OTP_LENGTH: "6",
    GOTRUE_MAILER_SUBJECTS_MAGIC_LINK: "Your YalePaths code",
    GOTRUE_MAILER_SUBJECTS_CONFIRMATION: "Your YalePaths code",
    GOTRUE_MAILER_TEMPLATES_MAGIC_LINK: `http://127.0.0.1:${apiPort}/email/magic_link.html`,
    GOTRUE_MAILER_TEMPLATES_CONFIRMATION: `http://127.0.0.1:${apiPort}/email/magic_link.html`,
    GOTRUE_MAILER_URLPATHS_CONFIRMATION: "/auth/v1/verify",
    GOTRUE_MAILER_URLPATHS_INVITE: "/auth/v1/verify",
    GOTRUE_MAILER_URLPATHS_RECOVERY: "/auth/v1/verify",
    GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE: "/auth/v1/verify",
    GOTRUE_SMTP_HOST: "127.0.0.1",
    GOTRUE_SMTP_PORT: String(smtpPort),
    GOTRUE_SMTP_ADMIN_EMAIL: "noreply@yalepaths.local",
    GOTRUE_SMTP_SENDER_NAME: "YalePaths",
    GOTRUE_SMTP_MAX_FREQUENCY: "1s",
    GOTRUE_HOOK_BEFORE_USER_CREATED_ENABLED: hook ? "true" : "false",
  };
  if (hook) env.GOTRUE_HOOK_BEFORE_USER_CREATED_URI = "pg-functions://postgres/public/hook_restrict_to_yale_email";
  return env;
}

async function waitFor(label, probe, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      if (await probe()) return;
    } catch {
      /* keep waiting */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function authUsersExist() {
  const output = await psql("yalepaths", "select to_regclass('auth.users')");
  return output.includes("auth.users");
}

function startAuth(hook) {
  return startProcess("auth", path.join(binDir, "auth"), ["serve"], authEnv(hook), binDir);
}

function startRest() {
  return startProcess(
    "postgrest",
    path.join(binDir, "postgrest"),
    [],
    {
      ...process.env,
      PGRST_DB_URI: `postgresql://authenticator@127.0.0.1:${dbPort}/yalepaths`,
      PGRST_DB_SCHEMAS: "public",
      PGRST_DB_ANON_ROLE: "anon",
      PGRST_DB_EXTRA_SEARCH_PATH: "public",
      PGRST_DB_CONFIG: "false",
      PGRST_DB_CHANNEL_ENABLED: "false",
      PGRST_JWT_SECRET: JWT_SECRET,
      PGRST_JWT_SECRET_IS_BASE64: "false",
      PGRST_SERVER_HOST: "127.0.0.1",
      PGRST_SERVER_PORT: String(restPort),
      PGRST_ADMIN_SERVER_PORT: "54331",
    },
    root,
  );
}

function startMail() {
  const server = net.createServer((socket) => {
    socket.write("220 yalepaths.local ESMTP\r\n");
    let mode = "cmd";
    let buffer = "";
    let recipient = "unknown";
    const takeLines = () => {
      while (mode === "cmd") {
        const index = buffer.indexOf("\r\n");
        if (index < 0) return;
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO") || upper.startsWith("HELO")) socket.write("250-yalepaths.local\r\n250 OK\r\n");
        else if (upper.startsWith("MAIL FROM")) socket.write("250 OK\r\n");
        else if (upper.startsWith("RCPT TO")) {
          const match = line.match(/<([^>]+)>/);
          recipient = (match ? match[1] : "unknown").toLowerCase();
          socket.write("250 OK\r\n");
        } else if (upper === "DATA") {
          mode = "data";
          socket.write("354 Go ahead\r\n");
        } else if (upper === "QUIT") {
          socket.write("221 bye\r\n");
          socket.end();
        } else socket.write("250 OK\r\n");
      }
    };
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (mode === "data") {
        const end = buffer.indexOf("\r\n.\r\n");
        if (end < 0) return;
        const body = buffer.slice(0, end);
        buffer = buffer.slice(end + 5);
        mode = "cmd";
        const safe = recipient.replace(/[^a-z0-9]+/gi, "_");
        fs.mkdirSync(mailDir, { recursive: true });
        fs.writeFileSync(path.join(mailDir, `${safe}.txt`), body);
        fs.writeFileSync(path.join(mailDir, `${Date.now()}-${safe}.txt`), body);
        socket.write("250 queued\r\n");
      }
      takeLines();
    });
  });
  server.on("error", (error) => {
    console.error(error);
    process.kill(process.pid, "SIGTERM");
  });
  server.listen(smtpPort, "127.0.0.1");
  return server;
}

function startProxy() {
  const server = http.createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": req.headers.origin || "*",
        "access-control-allow-headers": req.headers["access-control-request-headers"] || "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-max-age": "86400",
      });
      res.end();
      return;
    }
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (url.pathname === "/email/magic_link.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync(path.join(root, "supabase/templates/magic_link.html")));
      return;
    }
    let port = 0;
    let targetPath = url.pathname + url.search;
    if (url.pathname.startsWith("/auth/v1")) {
      port = authPort;
      targetPath = (url.pathname.replace(/^\/auth\/v1/, "") || "/") + url.search;
    } else if (url.pathname.startsWith("/rest/v1")) {
      port = restPort;
      targetPath = (url.pathname.replace(/^\/rest\/v1/, "") || "/") + url.search;
    } else {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const headers = { ...req.headers, host: `127.0.0.1:${port}` };
    delete headers["transfer-encoding"];
    const upstream = http.request({ hostname: "127.0.0.1", port, path: targetPath, method: req.method, headers }, (upstreamResponse) => {
      const out = { ...upstreamResponse.headers };
      delete out["transfer-encoding"];
      delete out.connection;
      if (req.headers.origin) {
        out["access-control-allow-origin"] = req.headers.origin;
        out.vary = "Origin";
      }
      res.writeHead(upstreamResponse.statusCode || 502, out);
      upstreamResponse.pipe(res);
    });
    upstream.on("error", (error) => {
      if (!res.headersSent) res.writeHead(502);
      res.end(error.message);
    });
    req.pipe(upstream);
  });
  server.on("error", (error) => {
    console.error(error);
    process.kill(process.pid, "SIGTERM");
  });
  server.listen(apiPort, "127.0.0.1");
  return server;
}

function writeEnv() {
  const file = path.join(root, ".env.local");
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const values = {
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${apiPort}`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: signRole("anon"),
    SUPABASE_SERVICE_ROLE_KEY: signRole("service_role"),
  };
  let text = existing;
  if (!/^NEXT_PUBLIC_SUPPORT_EMAIL=/m.test(text)) values.NEXT_PUBLIC_SUPPORT_EMAIL = "removal@yalepaths.local";
  if (!/^YALEPATHS_DEV_EMAIL_SIGNIN=/m.test(text)) values.YALEPATHS_DEV_EMAIL_SIGNIN = "true";
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    text = pattern.test(text) ? text.replace(pattern, line) : `${text}${text.endsWith("\n") || text === "" ? "" : "\n"}${line}\n`;
  }
  fs.writeFileSync(file, text.endsWith("\n") ? text : `${text}\n`);
}

async function httpOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  await stopPostgres();
}

async function main() {
  if (process.argv[2] === "stop") {
    await stopRecorded();
    log("stopped");
    return;
  }
  if (process.argv[2] === "reset") {
    await stopRecorded();
    fs.rmSync(pgData, { recursive: true, force: true });
    fs.rmSync(path.join(stackDir, "migration-applied"), { force: true });
  } else if (await httpOk(`http://127.0.0.1:${apiPort}/auth/v1/health`)) {
    log("already running at http://127.0.0.1:54321");
    return;
  }

  ensureLibpq();
  if (!fs.existsSync(path.join(binDir, "auth")) || !fs.existsSync(path.join(binDir, "postgrest"))) {
    throw new Error("Auth and PostgREST binaries are missing from .bin. See the README for the download URLs.");
  }
  await ensureDatabase();

  log("applying Auth migrations");
  await command(path.join(binDir, "auth"), ["migrate"], { cwd: binDir, env: authEnv(false) });

  const marker = path.join(stackDir, "migration-applied");
  const appliedPath = path.join(stackDir, "migrations-applied");
  const applied = new Set(
    fs.existsSync(appliedPath)
      ? fs.readFileSync(appliedPath, "utf8").split(/\r?\n/).filter(Boolean)
      : fs.existsSync(marker)
        ? ["20261117120000_init.sql"]
        : [],
  );
  const migrationsDir = path.join(root, "supabase/migrations");
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    log(`applying ${file}`);
    await psqlFile("yalepaths", path.join(migrationsDir, file));
    applied.add(file);
  }
  fs.writeFileSync(appliedPath, `${[...applied].join("\n")}\n`);

  const auth = startAuth(true);
  const rest = startRest();
  startMail();
  startProxy();
  writeEnv();
  fs.writeFileSync(path.join(stackDir, "pids.json"), JSON.stringify({ stack: process.pid, auth: auth.pid, rest: rest.pid }));

  await waitFor("Auth health", () => httpOk(`http://127.0.0.1:${apiPort}/auth/v1/health`));
  await waitFor("PostgREST", () => httpOk(`http://127.0.0.1:${apiPort}/rest/v1/`));
  log("ready at http://127.0.0.1:54321");
  log("codes are written to .stack/mail and are not delivered to real inboxes");
  log("next: npm run seed && npm run dev");

  const done = new Promise((resolve) => {
    process.on("SIGINT", () => resolve());
    process.on("SIGTERM", () => resolve());
  });
  await done;
  await shutdown();
}

main().catch(async (error) => {
  console.error(error);
  await shutdown();
  process.exit(1);
});
