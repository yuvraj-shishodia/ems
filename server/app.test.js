import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openStore, seed } from "./store.js";
import { createApp } from "./app.js";
const password = "Test-only-password-42";
async function fixture(t) {
  const db = openStore(":memory:");
  seed(db, password);
  const server = createApp(db);
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
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "EMS",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: res.status,
      data: await res.json(),
      cookie: res.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function login(email) {
    return (await request("/login", "POST", { email, password })).cookie;
  }
  return { db, request, login, base };
}
test("sessions require valid credentials, omit password hashes, and logout revokes access", async (t) => {
  const { request, login } = await fixture(t);
  assert.equal((await request("/workspace")).status, 401);
  assert.equal(
    (
      await request("/login", "POST", {
        email: "admin@ems.local",
        password: "incorrect",
      })
    ).status,
    401,
  );
  const cookie = await login("admin@ems.local");
  const me = await request("/me", "GET", null, cookie);
  assert.equal(me.data.user.role, "admin");
  assert.equal(me.data.user.password, undefined);
  await request("/logout", "POST", {}, cookie);
  assert.equal((await request("/me", "GET", null, cookie)).status, 401);
});
test("employees see only their own work and cannot create users, assign, delete or alter another employee task", async (t) => {
  const { request, login } = await fixture(t);
  const cookie = await login("jamie@ems.local");
  const workspace = await request("/workspace", "GET", null, cookie);
  assert.equal(workspace.data.users.length, 1);
  assert.ok(workspace.data.tasks.every((task) => task.assignee === 2));
  assert.equal((await request("/users", "POST", {}, cookie)).status, 403);
  assert.equal((await request("/tasks", "POST", {}, cookie)).status, 403);
  assert.equal(
    (await request("/tasks/2", "PATCH", { status: "active" }, cookie)).status,
    403,
  );
  assert.equal((await request("/tasks/1", "DELETE", null, cookie)).status, 403);
});
test("admin creates employee and task; employee accepts and completes; terminal transitions are rejected", async (t) => {
  const { request, login } = await fixture(t);
  const admin = await login("admin@ems.local");
  const created = await request(
    "/users",
    "POST",
    {
      name: "Test Person",
      email: "test@example.com",
      password,
      department: "QA",
    },
    admin,
  );
  assert.equal(created.status, 201);
  assert.equal(
    (
      await request(
        "/users",
        "POST",
        { name: "Duplicate", email: "test@example.com", password },
        admin,
      )
    ).status,
    409,
  );
  const employee = await login("test@example.com");
  const task = await request(
    "/tasks",
    "POST",
    {
      title: "Verify release",
      description: "Run acceptance checks",
      assignee: created.data.id,
      due: "2027-01-15",
      priority: "high",
      category: "QA",
    },
    admin,
  );
  assert.equal(task.status, 201);
  const path = "/tasks/" + task.data.id;
  assert.equal(
    (await request(path, "PATCH", { status: "completed" }, employee)).status,
    400,
  );
  assert.equal(
    (await request(path, "PATCH", { status: "active" }, employee)).status,
    200,
  );
  assert.equal(
    (await request(path, "PATCH", { status: "completed" }, employee)).status,
    200,
  );
  assert.equal(
    (await request(path, "PATCH", { status: "failed" }, employee)).status,
    400,
  );
  assert.equal((await request(path, "DELETE", null, admin)).status, 200);
});
test("deactivation revokes existing sessions and prevents login and assignment", async (t) => {
  const { request, login } = await fixture(t);
  const admin = await login("admin@ems.local"),
    employee = await login("jamie@ems.local");
  assert.equal(
    (await request("/users/2", "PATCH", { active: false }, admin)).status,
    200,
  );
  assert.equal((await request("/me", "GET", null, employee)).status, 401);
  assert.equal(
    (await request("/login", "POST", { email: "jamie@ems.local", password }))
      .status,
    401,
  );
  assert.equal(
    (
      await request(
        "/tasks",
        "POST",
        {
          title: "Test",
          description: "Test",
          assignee: 2,
          due: "2027-01-15",
          priority: "low",
        },
        admin,
      )
    ).status,
    400,
  );
});
test("password updates persist and revoke other sessions", async (t) => {
  const { request, login } = await fixture(t);
  const one = await login("jamie@ems.local"),
    two = await login("jamie@ems.local");
  assert.equal(
    (
      await request(
        "/password",
        "POST",
        { current: password, password: "short" },
        one,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/password",
        "POST",
        { current: password, password: "Updated-test-password-42" },
        one,
      )
    ).status,
    200,
  );
  assert.equal((await request("/me", "GET", null, two)).status, 401);
  assert.equal((await request("/me", "GET", null, one)).status, 200);
  assert.equal(
    (await request("/login", "POST", { email: "jamie@ems.local", password }))
      .status,
    401,
  );
});
test("validates input, rejects CSRF and rate limits failed sign-ins", async (t) => {
  const { request, login, base } = await fixture(t);
  const admin = await login("admin@ems.local");
  const csrf = await fetch(base + "/api/logout", {
    method: "POST",
    headers: { Cookie: admin },
  });
  assert.equal(csrf.status, 403);
  assert.equal(
    (
      await request(
        "/tasks",
        "POST",
        {
          title: "Bad date",
          description: "Test",
          assignee: 2,
          due: "2027-02-31",
          priority: "low",
        },
        admin,
      )
    ).status,
    400,
  );
  for (let i = 0; i < 10; i++)
    await request("/login", "POST", { email: "missing@example.com", password });
  assert.equal(
    (
      await request("/login", "POST", {
        email: "missing@example.com",
        password,
      })
    ).status,
    429,
  );
});

test("admin edits task content and employee cannot reassign their work", async (t) => {
  const { request, login } = await fixture(t);
  const admin = await login("admin@ems.local"),
    employee = await login("jamie@ems.local");
  const body = {
    title: "Updated onboarding",
    description: "Revised requirements",
    assignee: 3,
    due: "2027-02-01",
    priority: "low",
    category: "Product",
  };
  assert.equal((await request("/tasks/1", "PUT", body, employee)).status, 403);
  assert.equal((await request("/tasks/1", "PUT", body, admin)).status, 200);
  const workspace = (await request("/workspace", "GET", null, admin)).data;
  const task = workspace.tasks.find((t) => t.id === 1);
  assert.equal(task.title, body.title);
  assert.equal(task.assignee, 3);
  assert.equal(task.status, "active");
  assert.ok(
    !(await request("/workspace", "GET", null, employee)).data.tasks.some(
      (t) => t.id === 1,
    ),
  );
});
test("disk database retains users, task updates and password hashes after reopen", async () => {
  const { mkdtempSync, rmSync, rmdirSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = mkdtempSync(join(tmpdir(), "ems-test-"));
  const path = join(directory, "test.sqlite");
  let db = openStore(path);
  try {
    seed(db, password);
    db.prepare("UPDATE tasks SET status='completed' WHERE id=1").run();
    const hash = db
      .prepare("SELECT password FROM users WHERE id=1")
      .get().password;
    assert.notEqual(hash, password);
    db.close();
    db = openStore(path);
    assert.equal(
      db.prepare("SELECT status FROM tasks WHERE id=1").get().status,
      "completed",
    );
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 4);
  } finally {
    db.close();
    for (const suffix of ["", "-wal", "-shm"])
      rmSync(path + suffix, { force: true });
    rmdirSync(directory);
  }
});
