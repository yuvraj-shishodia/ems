import http from "node:http";
import { randomBytes } from "node:crypto";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { hashPassword, verifyPassword } from "./store.js";
import { authRoutes, safeUser, userQuery } from "./auth.js";
const clean = (value, max = 200) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
export function createApp(
  db,
  {
    production = false,
    dist = resolve("dist"),
    appUrl = "http://127.0.0.1:3001",
    providers = {},
  } = {},
) {
  const auth = authRoutes(db, { appUrl, providers, production });
  const attempts = new Map();
  const log = (user, message) =>
    db
      .prepare(
        "INSERT INTO activity(user_id,message,workspace_id) VALUES(?,?,?)",
      )
      .run(user.id, message, user.workspace_id);
  return http.createServer(async (req, res) => {
    const send = (status, data, headers = {}) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...headers,
      });
      res.end(JSON.stringify(data));
    };
    const fail = (status, message) => {
      const e = new Error(message);
      e.status = status;
      throw e;
    };
    try {
      const url = new URL(req.url, "http://localhost");
      const path = url.pathname;
      if (!path.startsWith("/api/")) {
        if (!existsSync(dist))
          return send(404, {
            error: "Build the frontend first or use npm run dev.",
          });
        let file = resolve(dist, "." + decodeURIComponent(path));
        if (file !== dist && !file.startsWith(dist + sep))
          return send(403, { error: "Forbidden" });
        if (!existsSync(file) || !statSync(file).isFile())
          file = resolve(dist, "index.html");
        const types = {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".png": "image/png",
        };
        res.writeHead(200, {
          "Content-Type": types[extname(file)] || "application/octet-stream",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy":
            "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          "Referrer-Policy": "no-referrer",
        });
        return res.end(readFileSync(file));
      }
      if (path === "/api/health") return send(200, { status: "ok" });
      if (!["GET", "HEAD"].includes(req.method)) {
        if (req.headers["x-requested-with"] !== "EMS")
          fail(403, "Invalid request. Refresh the page and try again.");
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host)
          fail(403, "Cross-origin requests are not allowed.");
      }
      let body = {};
      if (["POST", "PATCH", "PUT"].includes(req.method)) {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > 16384)
            fail(413, "Request is too large.");
        }
        try {
          body = JSON.parse(raw || "{}");
          if (!body || typeof body !== "object" || Array.isArray(body))
            fail(400, "Send a JSON object.");
        } catch {
          fail(400, "Invalid JSON.");
        }
      }
      const cookie = req.headers.cookie || "";
      const token = cookie
        .split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("ems_session="))
        ?.slice(12);
      const session = token
        ? db
            .prepare(
              userQuery +
                " JOIN sessions ON users.id=sessions.user_id WHERE token=? AND expires>? AND active=1",
            )
            .get(token, Date.now())
        : null;
      if (await auth({ req, res, url, path, body, session, send, fail }))
        return;
      if (path === "/api/login" && req.method === "POST") {
        const ip = req.socket.remoteAddress;
        const now = Date.now();
        const rate = attempts.get(ip) || { n: 0, until: now + 900000 };
        if (rate.until < now) {
          rate.n = 0;
          rate.until = now + 900000;
        }
        attempts.set(ip, rate);
        if (attempts.size > 10000)
          for (const [key, value] of attempts)
            if (value.until < now) attempts.delete(key);
        if (rate.n >= 10)
          fail(429, "Too many attempts. Try again in 15 minutes.");
        rate.n++;
        const user = db
          .prepare(
            userQuery + " WHERE email=? AND active=1 AND password_enabled=1",
          )
          .get(clean(body.email).toLowerCase());
        if (typeof body.password !== "string" || body.password.length > 128)
          fail(400, "Enter a valid password.");
        if (!user || !verifyPassword(body.password, user.password))
          fail(401, "Email or password is incorrect.");
        attempts.delete(ip);
        const key = randomBytes(32).toString("hex");
        db.prepare("DELETE FROM sessions WHERE expires<?").run(now);
        db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
          key,
          user.id,
          now + 28800000,
        );
        return send(
          200,
          { user: safeUser(user) },
          {
            "Set-Cookie": `ems_session=${key}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${production ? "; Secure" : ""}`,
          },
        );
      }
      if (!session) fail(401, "Please sign in to continue.");
      if (path === "/api/logout" && req.method === "POST") {
        db.prepare("DELETE FROM sessions WHERE token=?").run(token);
        return send(
          200,
          { ok: true },
          {
            "Set-Cookie":
              "ems_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
          },
        );
      }
      if (path === "/api/me" && req.method === "GET")
        return send(200, { user: safeUser(session) });
      if (path === "/api/password" && req.method === "POST") {
        if (!session.password_enabled)
          fail(
            400,
            "This account uses social sign-in. Use the same provider to sign in.",
          );
        if (
          typeof body.current !== "string" ||
          body.current.length > 128 ||
          !verifyPassword(body.current, session.password)
        )
          fail(400, "Current password is incorrect.");
        if (
          typeof body.password !== "string" ||
          body.password.length < 10 ||
          body.password.length > 128
        )
          fail(400, "Use a password between 10 and 128 characters.");
        db.prepare("UPDATE users SET password=? WHERE id=?").run(
          hashPassword(body.password),
          session.id,
        );
        db.prepare("DELETE FROM sessions WHERE user_id=? AND token<>?").run(
          session.id,
          token,
        );
        return send(200, { ok: true });
      }
      if (path === "/api/workspace" && req.method === "GET") {
        const users =
          session.role === "admin"
            ? db
                .prepare(
                  "SELECT * FROM users WHERE workspace_id=? ORDER BY name",
                )
                .all(session.workspace_id)
                .map(safeUser)
            : [safeUser(session)];
        const tasks =
          session.role === "admin"
            ? db
                .prepare(
                  "SELECT * FROM tasks WHERE workspace_id=? ORDER BY id DESC",
                )
                .all(session.workspace_id)
            : db
                .prepare(
                  "SELECT * FROM tasks WHERE assignee=? AND workspace_id=? ORDER BY id DESC",
                )
                .all(session.id, session.workspace_id);
        const activity =
          session.role === "admin"
            ? db
                .prepare(
                  "SELECT activity.*,users.name FROM activity JOIN users ON users.id=user_id WHERE activity.workspace_id=? ORDER BY activity.id DESC LIMIT 20",
                )
                .all(session.workspace_id)
            : db
                .prepare(
                  "SELECT activity.*,users.name FROM activity JOIN users ON users.id=user_id WHERE user_id=? AND activity.workspace_id=? ORDER BY activity.id DESC LIMIT 20",
                )
                .all(session.id, session.workspace_id);
        const workspace = db
          .prepare(
            "SELECT id,name,slug,setup_complete FROM workspaces WHERE id=?",
          )
          .get(session.workspace_id);
        return send(200, { users, tasks, activity, workspace });
      }
      if (
        req.method !== "GET" &&
        (!session.setup_complete || !session.onboarding_complete)
      )
        fail(
          403,
          "Complete workspace setup before managing your team or tasks.",
        );
      if (path === "/api/users" && req.method === "POST") {
        if (session.role !== "admin")
          fail(403, "Only administrators can manage employees.");
        const name = clean(body.name, 80),
          email = clean(body.email).toLowerCase(),
          department = clean(body.department, 60) || "General";
        if (
          !name ||
          !/^\S+@\S+\.\S+$/.test(email) ||
          typeof body.password !== "string" ||
          body.password.length < 10 ||
          body.password.length > 128
        )
          fail(
            400,
            "Enter a name, valid email and a password of 10–128 characters.",
          );
        if (db.prepare("SELECT id FROM users WHERE email=?").get(email))
          fail(409, "This email already belongs to a team member.");
        const result = db
          .prepare(
            "INSERT INTO users(name,email,password,role,department,workspace_id) VALUES(?,?,?,'employee',?,?)",
          )
          .run(
            name,
            email,
            hashPassword(body.password),
            department,
            session.workspace_id,
          );
        log(session, `Added ${name} to the team.`);
        return send(201, { id: Number(result.lastInsertRowid) });
      }
      const userMatch = path.match(/^\/api\/users\/(\d+)$/);
      if (userMatch && req.method === "PATCH") {
        if (session.role !== "admin")
          fail(403, "Only administrators can manage employees.");
        const id = Number(userMatch[1]);
        const user = db
          .prepare("SELECT * FROM users WHERE id=? AND workspace_id=?")
          .get(id, session.workspace_id);
        if (!user || user.role === "admin")
          fail(400, "This employee cannot be changed.");
        if (typeof body.active !== "boolean")
          fail(400, "Choose an active state.");
        db.prepare("UPDATE users SET active=? WHERE id=?").run(
          Number(body.active),
          id,
        );
        if (!body.active)
          db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
        log(
          session,
          `${body.active ? "Reactivated" : "Deactivated"} ${user.name}.`,
        );
        return send(200, { ok: true });
      }
      if (
        (path === "/api/tasks" && req.method === "POST") ||
        (/^\/api\/tasks\/\d+$/.test(path) && req.method === "PUT")
      ) {
        if (session.role !== "admin")
          fail(403, "Only administrators can assign tasks.");
        const title = clean(body.title, 120),
          description = clean(body.description, 2000),
          category = clean(body.category, 50) || "General",
          due = clean(body.due, 10);
        const assignee = Number(body.assignee);
        if (
          !title ||
          !description ||
          !/^\d{4}-\d{2}-\d{2}$/.test(due) ||
          Number.isNaN(Date.parse(due)) ||
          new Date(due).toISOString().slice(0, 10) !== due ||
          !["low", "medium", "high"].includes(body.priority) ||
          !db
            .prepare(
              "SELECT id FROM users WHERE id=? AND active=1 AND role='employee' AND workspace_id=?",
            )
            .get(assignee, session.workspace_id)
        )
          fail(400, "Complete every task field and select an active employee.");
        if (req.method === "PUT") {
          const id = Number(path.split("/").pop());
          if (
            !db
              .prepare("SELECT id FROM tasks WHERE id=? AND workspace_id=?")
              .get(id, session.workspace_id)
          )
            fail(404, "Task no longer exists. Refresh the list.");
          db.prepare(
            "UPDATE tasks SET title=?,description=?,assignee=?,due=?,priority=?,category=? WHERE id=?",
          ).run(title, description, assignee, due, body.priority, category, id);
          log(session, `Updated “${title}”.`);
          return send(200, { ok: true });
        }
        const result = db
          .prepare(
            "INSERT INTO tasks(title,description,assignee,due,priority,category,workspace_id) VALUES(?,?,?,?,?,?,?)",
          )
          .run(
            title,
            description,
            assignee,
            due,
            body.priority,
            category,
            session.workspace_id,
          );
        log(session, `Assigned “${title}”.`);
        return send(201, { id: Number(result.lastInsertRowid) });
      }
      const match = path.match(/^\/api\/tasks\/(\d+)$/);
      if (match) {
        const id = Number(match[1]);
        const task = db
          .prepare("SELECT * FROM tasks WHERE id=? AND workspace_id=?")
          .get(id, session.workspace_id);
        if (!task) fail(404, "Task no longer exists. Refresh the list.");
        if (req.method === "DELETE") {
          if (session.role !== "admin")
            fail(403, "Only administrators can delete tasks.");
          db.prepare("DELETE FROM tasks WHERE id=?").run(id);
          log(session, `Deleted “${task.title}”.`);
          return send(200, { ok: true });
        }
        if (req.method === "PATCH") {
          if (session.role !== "admin" && task.assignee !== session.id)
            fail(403, "This task is assigned to another employee.");
          const allowed = {
            new: ["active"],
            active: ["completed", "failed"],
            completed: [],
            failed: [],
          };
          const valid =
            session.role === "admin"
              ? ["new", "active", "completed", "failed"].includes(body.status)
              : allowed[task.status].includes(body.status);
          if (!valid)
            fail(400, "This status change is not available. Refresh the task.");
          const result = db
            .prepare("UPDATE tasks SET status=? WHERE id=? AND status=?")
            .run(body.status, id, task.status);
          if (!result.changes)
            fail(409, "Task changed. Refresh and try again.");
          log(session, `Marked “${task.title}” as ${body.status}.`);
          return send(200, { ok: true });
        }
      }
      return send(404, { error: "This endpoint does not exist." });
    } catch (error) {
      if (!error.status) console.error("Request failed:", error.message);
      send(error.status || 500, {
        error: error.status
          ? error.message
          : "Something went wrong. Try again.",
      });
    }
  });
}
