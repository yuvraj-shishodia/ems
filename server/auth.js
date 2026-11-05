import { randomBytes, createHash } from "node:crypto";
import { hashPassword, transaction } from "./store.js";
export const safeUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  department: u.department,
  active: !!u.active,
  workspace_id: u.workspace_id,
  onboarding_complete: !!u.onboarding_complete,
  password_enabled: !!u.password_enabled,
  workspace: {
    id: u.workspace_id,
    name: u.workspace_name,
    slug: u.workspace_slug,
    setup_complete: !!u.setup_complete,
  },
});
export const userQuery =
  "SELECT users.*,workspaces.name AS workspace_name,workspaces.slug AS workspace_slug,workspaces.setup_complete FROM users JOIN workspaces ON workspaces.id=users.workspace_id";
const text = (v, max = 200) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const validEmail = (v) => /^\S+@\S+\.\S+$/.test(v);
const digest = (v) => createHash("sha256").update(v).digest("hex");
export function authRoutes(db, { appUrl, providers = {}, production = false }) {
  const base = new URL(appUrl);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.pathname !== "/"
  )
    throw new Error("APP_URL must be an HTTP(S) origin without a path.");
  if (production && base.protocol !== "https:")
    throw new Error("APP_URL must use HTTPS in production.");
  const rates = new Map();
  function throttle(key, limit = 6) {
    const now = Date.now();
    if (rates.size >= 10000)
      for (const [k, r] of rates) if (r.until < now) rates.delete(k);
    const r = rates.get(key) || { count: 0, until: now + 900000 };
    if (r.until < now) {
      r.count = 0;
      r.until = now + 900000;
    }
    r.count++;
    rates.set(key, r);
    if (r.count > limit) {
      const e = new Error("Too many attempts. Try again in 15 minutes.");
      e.status = 429;
      throw e;
    }
  }
  const sessionFor = (user) => {
    const key = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      key,
      user.id,
      Date.now() + 28800000,
    );
    return `ems_session=${key}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${production ? "; Secure" : ""}`;
  };
  function createAccount({ name, email, password, identity }) {
    return transaction(db, () => {
      const workspaceId = Number(
        db
          .prepare("INSERT INTO workspaces(name,slug) VALUES(?,?)")
          .run(
            `${name.split(" ")[0]}'s workspace`,
            "team-" + randomBytes(6).toString("hex"),
          ).lastInsertRowid,
      );
      const id = Number(
        db
          .prepare(
            "INSERT INTO users(name,email,password,role,workspace_id,active,email_verified,onboarding_complete,password_enabled) VALUES(?,?,?,'admin',?,1,?,0,?)",
          )
          .run(
            name,
            email,
            hashPassword(password || randomBytes(48).toString("hex")),
            workspaceId,
            identity ? 1 : 0,
            identity ? 0 : 1,
          ).lastInsertRowid,
      );
      if (identity)
        db.prepare(
          "INSERT INTO oauth_identities(provider,subject,user_id) VALUES(?,?,?)",
        ).run(identity.provider, identity.subject, id);
      return db.prepare(userQuery + " WHERE users.id=?").get(id);
    });
  }
  return async function route({
    req,
    res,
    url,
    path,
    body,
    session,
    send,
    fail,
  }) {
    if (path === "/api/auth/config" && req.method === "GET") {
      send(200, {
        providers: ["google"].map((id) => ({
          id,
          name: "Google",
          enabled: !!providers[id],
        })),
      });
      return true;
    }
    if (path === "/api/signup" && req.method === "POST") {
      throttle("signup:" + req.socket.remoteAddress);
      const name = text(body.name, 80),
        email = text(body.email).toLowerCase();
      if (
        !name ||
        !validEmail(email) ||
        typeof body.password !== "string" ||
        body.password.length < 10 ||
        body.password.length > 128
      )
        fail(
          400,
          "Enter your name, a valid email and a password of 10–128 characters.",
        );
      if (db.prepare("SELECT id FROM users WHERE email=?").get(email))
        fail(
          409,
          "An account already uses this email. Sign in with your original method.",
        );
      const user = createAccount({ name, email, password: body.password });
      send(201, { user: safeUser(user) }, { "Set-Cookie": sessionFor(user) });
      return true;
    }
    const start = path.match(/^\/api\/oauth\/(google)\/start$/);
    if (start && req.method === "GET") {
      throttle("oauth:" + req.socket.remoteAddress, 30);
      const id = start[1],
        provider = providers[id];
      if (!provider)
        fail(
          503,
          "This sign-in provider is not configured. Use email and password for now.",
        );
      const state = randomBytes(32).toString("hex"),
        binding = randomBytes(32).toString("hex"),
        verifier = randomBytes(32).toString("base64url"),
        nonce = randomBytes(32).toString("hex");
      db.prepare("DELETE FROM oauth_states WHERE expires<?").run(Date.now());
      db.prepare("INSERT INTO oauth_states VALUES(?,?,?,?,?,?)").run(
        digest(state),
        id,
        digest(binding),
        verifier,
        nonce,
        Date.now() + 600000,
      );
      const redirectUri = new URL(`/api/oauth/${id}/callback`, base).toString();
      const target = new URL(provider.authorization);
      const params = {
        client_id: provider.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: provider.scope,
        state,
        nonce,
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
      };
      for (const [key, value] of Object.entries(params))
        target.searchParams.set(key, value);
      res.writeHead(302, {
        Location: target.toString(),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Set-Cookie": `ems_oauth=${binding}; HttpOnly; SameSite=Lax; Path=/api/oauth; Max-Age=600${production ? "; Secure" : ""}`,
      });
      res.end();
      return true;
    }
    const callback = path.match(/^\/api\/oauth\/(google)\/callback$/);
    if (callback && req.method === "GET") {
      const clear = `ems_oauth=; HttpOnly; SameSite=Lax; Path=/api/oauth; Max-Age=0${production ? "; Secure" : ""}`;
      const redirect = (error, user) => {
        res.writeHead(302, {
          Location: new URL(
            error ? "/login?authError=" + error : "/",
            base,
          ).toString(),
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "Set-Cookie": user ? [clear, sessionFor(user)] : clear,
        });
        res.end();
      };
      const state = url.searchParams.get("state") || "",
        binding =
          (req.headers.cookie || "")
            .split(";")
            .map((v) => v.trim())
            .find((v) => v.startsWith("ems_oauth="))
            ?.slice(10) || "";
      const row = /^[a-f0-9]{64}$/.test(state)
        ? db
            .prepare(
              "SELECT * FROM oauth_states WHERE hash=? AND provider=? AND binding=? AND expires>?",
            )
            .get(digest(state), callback[1], digest(binding), Date.now())
        : null;
      if (!row) {
        redirect("expired");
        return true;
      }
      db.prepare("DELETE FROM oauth_states WHERE hash=?").run(row.hash);
      if (url.searchParams.get("error")) {
        redirect("cancelled");
        return true;
      }
      const code = url.searchParams.get("code"),
        provider = providers[callback[1]];
      if (!code || !provider) {
        redirect("failed");
        return true;
      }
      try {
        const identity = await provider.exchange({
          code,
          verifier: row.verifier,
          nonce: row.nonce,
          redirectUri: new URL(
            `/api/oauth/${callback[1]}/callback`,
            base,
          ).toString(),
        });
        const email = text(identity.email).toLowerCase(),
          name = text(identity.name, 80);
        if (
          !validEmail(email) ||
          !name ||
          typeof identity.subject !== "string" ||
          !identity.subject
        )
          throw new Error("Invalid identity");
        const existing = db
          .prepare(
            "SELECT user_id FROM oauth_identities WHERE provider=? AND subject=?",
          )
          .get(callback[1], identity.subject);
        let user;
        if (existing) {
          user = db
            .prepare(userQuery + " WHERE users.id=? AND active=1")
            .get(existing.user_id);
          if (!user) {
            redirect("unavailable");
            return true;
          }
        } else {
          if (db.prepare("SELECT id FROM users WHERE email=?").get(email)) {
            redirect("existing");
            return true;
          }
          user = createAccount({
            name,
            email,
            identity: { provider: callback[1], subject: identity.subject },
          });
        }
        redirect(null, user);
      } catch {
        redirect("failed");
      }
      return true;
    }
    if (!session) return false;
    if (path === "/api/setup" && req.method === "POST") {
      const name = text(body.name, 80),
        department = text(body.department, 60) || "General";
      if (!name) fail(400, "Enter your name.");
      const workspaceName = text(body.workspaceName, 80),
        slug = text(body.slug, 50).toLowerCase();
      if (session.role === "admin" && !session.setup_complete) {
        if (!workspaceName || !/^[a-z0-9][a-z0-9-]{2,49}$/.test(slug))
          fail(
            400,
            "Enter a workspace name and a URL using 3–50 lowercase letters, numbers or hyphens.",
          );
        if (
          db
            .prepare("SELECT id FROM workspaces WHERE slug=? AND id<>?")
            .get(slug, session.workspace_id)
        )
          fail(409, "This workspace URL is taken. Choose another.");
      }
      transaction(db, () => {
        if (session.role === "admin" && !session.setup_complete)
          db.prepare(
            "UPDATE workspaces SET name=?,slug=?,setup_complete=1 WHERE id=?",
          ).run(workspaceName, slug, session.workspace_id);
        db.prepare(
          "UPDATE users SET name=?,department=?,onboarding_complete=1 WHERE id=?",
        ).run(name, department, session.id);
        db.prepare(
          "INSERT INTO activity(user_id,workspace_id,message) VALUES(?,?,?)",
        ).run(
          session.id,
          session.workspace_id,
          `${name} completed workspace setup.`,
        );
      });
      const user = db.prepare(userQuery + " WHERE users.id=?").get(session.id);
      send(200, { user: safeUser(user) });
      return true;
    }
    return false;
  };
}
