import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { DatabaseSync } from "node:sqlite";
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from "jose";
import { openStore, seed, migrate } from "./store.js";
import { createApp } from "./app.js";
import { verifyGoogleToken, createProviders } from "./oauth.js";
const password = "Test-only-onboarding-password-42";
async function fixture(t, providers = {}) {
  const db = openStore(":memory:");
  seed(db, password);
  const server = createApp(db, { providers, appUrl: "http://127.0.0.1:3011" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    server.close();
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, method = "GET", body, cookie) {
    const res = await fetch(base + "/api" + path, {
      method,
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "EMS",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const raw = await res.text();
    return {
      status: res.status,
      data: raw ? JSON.parse(raw) : null,
      cookies: res.headers.getSetCookie(),
      cookie: res.headers.get("set-cookie")?.split(";")[0],
      location: res.headers.get("location"),
    };
  }
  return { db, request };
}
const signup = (request, email, name = "Taylor Owner") =>
  request("/signup", "POST", { name, email, password });
const setup = (request, cookie, slug = "northstar-team") =>
  request(
    "/setup",
    "POST",
    {
      name: "Taylor Owner",
      department: "Engineering",
      workspaceName: "Northstar Studio",
      slug,
    },
    cookie,
  );
test("signup creates an administrator and empty isolated workspace; setup persists after login", async (t) => {
  const { request } = await fixture(t);
  const created = await signup(request, "owner@example.com");
  assert.equal(created.status, 201);
  assert.equal(created.data.user.role, "admin");
  assert.equal(created.data.user.workspace.setup_complete, false);
  assert.equal(created.data.user.onboarding_complete, false);
  assert.equal(
    (await request("/tasks", "POST", {}, created.cookie)).status,
    403,
  );
  const result = await setup(request, created.cookie);
  assert.equal(result.status, 200);
  assert.equal(result.data.user.workspace.name, "Northstar Studio");
  assert.equal(result.data.user.workspace.slug, "northstar-team");
  assert.equal(result.data.user.onboarding_complete, true);
  const workspace = await request("/workspace", "GET", null, created.cookie);
  assert.equal(workspace.data.users.length, 1);
  assert.equal(workspace.data.tasks.length, 0);
  assert.equal(workspace.data.activity.length, 1);
  const login = await request("/login", "POST", {
    email: "owner@example.com",
    password,
  });
  assert.equal(login.data.user.workspace.name, "Northstar Studio");
});
test("duplicate emails, invalid passwords and conflicting workspace URLs are rejected", async (t) => {
  const { db, request } = await fixture(t);
  assert.equal((await signup(request, "admin@ems.local")).status, 409);
  assert.equal(
    (
      await request("/signup", "POST", {
        name: "Owner",
        email: "bad",
        password: "short",
      })
    ).status,
    400,
  );
  const before = db.prepare("SELECT COUNT(*) AS n FROM workspaces").get().n;
  assert.equal((await signup(request, "owner@example.com")).status, 201);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM workspaces").get().n,
    before + 1,
  );
  const second = await signup(request, "second@example.com");
  assert.equal((await setup(request, second.cookie, "workplace")).status, 409);
  assert.equal((await setup(request, second.cookie, "ab")).status, 400);
  assert.equal(
    (await setup(request, second.cookie, "second-team")).status,
    200,
  );
});
test("tenant isolation covers read, edit, delete, status, employee access and assignment", async (t) => {
  const { request } = await fixture(t);
  const owner = await signup(request, "owner@example.com");
  await setup(request, owner.cookie);
  const admin = await request("/login", "POST", {
    email: "admin@ems.local",
    password,
  });
  const foreign = await request("/workspace", "GET", null, owner.cookie);
  assert.ok(!foreign.data.users.some((u) => u.email === "jamie@ems.local"));
  assert.deepEqual(foreign.data.tasks, []);
  for (const method of ["PATCH", "DELETE", "PUT"])
    assert.equal(
      (
        await request(
          "/tasks/1",
          method,
          method === "PUT"
            ? {
                title: "Hijack",
                description: "Test",
                due: "2027-01-01",
                assignee: 2,
                priority: "high",
              }
            : { status: "completed" },
          owner.cookie,
        )
      ).status,
      method === "PUT" ? 400 : 404,
    );
  assert.equal(
    (await request("/users/2", "PATCH", { active: false }, owner.cookie))
      .status,
    400,
  );
  assert.equal(
    (
      await request(
        "/tasks",
        "POST",
        {
          title: "Cross-tenant",
          description: "No",
          assignee: 2,
          due: "2027-01-01",
          priority: "low",
        },
        owner.cookie,
      )
    ).status,
    400,
  );
  const employee = await request(
    "/users",
    "POST",
    {
      name: "Our Employee",
      email: "our-employee@example.com",
      password,
      department: "QA",
    },
    owner.cookie,
  );
  assert.equal(employee.status, 201);
  const task = await request(
    "/tasks",
    "POST",
    {
      title: "Our task",
      description: "Private work",
      assignee: employee.data.id,
      due: "2027-01-01",
      priority: "low",
    },
    owner.cookie,
  );
  assert.equal(task.status, 201);
  assert.equal(
    (await request("/tasks/" + task.data.id, "DELETE", null, admin.cookie))
      .status,
    404,
  );
  assert.ok(
    !(await request("/workspace", "GET", null, admin.cookie)).data.users.some(
      (u) => u.id === employee.data.id,
    ),
  );
  assert.ok(
    !(await request("/workspace", "GET", null, admin.cookie)).data.tasks.some(
      (u) => u.id === task.data.id,
    ),
  );
});
test("legacy data migration preserves rows, sessions and enables foreign keys", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    `PRAGMA foreign_keys=ON;CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,email TEXT UNIQUE,password TEXT,role TEXT,department TEXT,active INTEGER);CREATE TABLE tasks(id INTEGER PRIMARY KEY,title TEXT,description TEXT,assignee INTEGER REFERENCES users(id),due TEXT,priority TEXT,status TEXT,category TEXT,created TEXT);CREATE TABLE activity(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),message TEXT,created TEXT);CREATE TABLE sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER);INSERT INTO users VALUES(1,'Existing','existing@example.com','hash','admin','General',1);INSERT INTO tasks VALUES(1,'Keep me','Existing task',1,'2027-01-01','high','new','Test','2026-01-01');INSERT INTO sessions VALUES('existing-session',1,9999999999999);`,
  );
  try {
    migrate(db);
    migrate(db);
    assert.equal(
      db.prepare("SELECT title,workspace_id FROM tasks").get().title,
      "Keep me",
    );
    assert.equal(
      db.prepare("SELECT workspace_id FROM users").get().workspace_id,
      1,
    );
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 1);
    assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});
function fakeGoogle(exchange) {
  return {
    google: {
      name: "Google",
      clientId: "test-client",
      authorization: "https://accounts.google.com/o/oauth2/v2/auth",
      scope: "openid email profile",
      exchange,
    },
  };
}
async function begin(request) {
  const start = await request("/oauth/google/start");
  return {
    cookie: start.cookie,
    state: new URL(start.location).searchParams.get("state"),
    url: new URL(start.location),
  };
}
test("Google authorization uses PKCE/state, creates workspace, and returning sign-in reuses identity", async (t) => {
  let exchanged;
  const { db, request } = await fixture(
    t,
    fakeGoogle(async (values) => {
      exchanged = values;
      return {
        subject: "google-sub-123",
        email: "google@example.com",
        name: "Google Person",
      };
    }),
  );
  let start = await begin(request);
  assert.equal(start.url.searchParams.get("code_challenge_method"), "S256");
  assert.ok(start.url.searchParams.get("nonce"));
  let callback = await request(
    "/oauth/google/callback?state=" + start.state + "&code=valid",
    "GET",
    null,
    start.cookie,
  );
  assert.equal(callback.status, 302);
  assert.ok(exchanged.verifier);
  assert.ok(exchanged.nonce);
  const cookie = callback.cookies
    .find((c) => c.startsWith("ems_session="))
    .split(";")[0];
  const user = (await request("/me", "GET", null, cookie)).data.user;
  assert.equal(user.password_enabled, false);
  assert.equal(user.onboarding_complete, false);
  assert.equal(
    (await request("/login", "POST", { email: "google@example.com", password }))
      .status,
    401,
  );
  assert.equal(
    (
      await request(
        "/oauth/google/callback?state=" + start.state + "&code=valid",
        "GET",
        null,
        start.cookie,
      )
    ).location,
    "http://127.0.0.1:3011/login?authError=expired",
  );
  await setup(request, cookie, "google-team");
  start = await begin(request);
  callback = await request(
    "/oauth/google/callback?state=" + start.state + "&code=valid",
    "GET",
    null,
    start.cookie,
  );
  assert.ok(callback.cookies.some((c) => c.startsWith("ems_session=")));
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM users WHERE email='google@example.com'",
      )
      .get().n,
    1,
  );
});
test("OAuth rejects missing browser binding, expired state and untrusted email-based linking", async (t) => {
  const { db, request } = await fixture(
    t,
    fakeGoogle(async () => ({
      subject: "other",
      email: "admin@ems.local",
      name: "Wrong Owner",
    })),
  );
  let start = await begin(request);
  assert.ok(
    (
      await request("/oauth/google/callback?state=" + start.state + "&code=x")
    ).location.endsWith("authError=expired"),
  );
  let result = await request(
    "/oauth/google/callback?state=" + start.state + "&code=x",
    "GET",
    null,
    start.cookie,
  );
  assert.ok(result.location.endsWith("authError=existing"));
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM oauth_identities").get().n,
    0,
  );
  start = await begin(request);
  db.prepare("UPDATE oauth_states SET expires=0").run();
  assert.ok(
    (
      await request(
        "/oauth/google/callback?state=" + start.state + "&code=x",
        "GET",
        null,
        start.cookie,
      )
    ).location.endsWith("authError=expired"),
  );
});
test("Google tokens must have a valid signature, audience, nonce and verified email", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "test-key";
  const keys = createLocalJWKSet({ keys: [jwk] });
  const sign = (claims) =>
    new SignJWT({
      email: "person@example.com",
      email_verified: true,
      nonce: "right-nonce",
      name: "Person",
      ...claims,
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer("https://accounts.google.com")
      .setAudience("test-client")
      .setSubject("subject")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
  const token = await sign({});
  assert.equal(
    (await verifyGoogleToken(token, "test-client", "right-nonce", keys)).email,
    "person@example.com",
  );
  await assert.rejects(
    verifyGoogleToken(token, "wrong-client", "right-nonce", keys),
  );
  await assert.rejects(
    verifyGoogleToken(token, "test-client", "wrong-nonce", keys),
  );
  await assert.rejects(
    verifyGoogleToken(
      await sign({ email_verified: false }),
      "test-client",
      "right-nonce",
      keys,
    ),
  );
  await assert.rejects(
    verifyGoogleToken(
      token.slice(0, -10) + "tampered",
      "test-client",
      "right-nonce",
      keys,
    ),
  );
});
test("provider configuration does not expose secrets and missing Google config is disabled", async (t) => {
  assert.deepEqual(createProviders({}), {});
  const { request } = await fixture(t);
  const config = await request("/auth/config");
  assert.deepEqual(config.data.providers, [
    { id: "google", name: "Google", enabled: false },
  ]);
  assert.equal((await request("/oauth/google/start")).status, 503);
});
