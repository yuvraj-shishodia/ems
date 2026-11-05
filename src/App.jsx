import Setup from "./ui/Setup";
import Field from "./ui/Field";
import Modal from "./ui/Modal";
import Login from "./ui/Login";
import {
  LayoutDashboard,
  ListTodo,
  UsersRound,
  History,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "./api";
const states = {
  new: "To do",
  active: "In progress",
  completed: "Completed",
  failed: "Blocked",
};
const initials = (name) =>
  name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
const date = (value) =>
  new Date(value + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
export default function App() {
  const [user, setUser] = useState(null),
    [boot, setBoot] = useState(true),
    [page, setPage] = useState("overview"),
    [data, setData] = useState({ users: [], tasks: [], activity: [] }),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState(null),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [view, setView] = useState("list");
  useEffect(() => {
    api("/me")
      .then((r) => setUser(r.user))
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
      })
      .finally(() => setBoot(false));
  }, []);
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setData(await api("/workspace"));
    } catch (e) {
      if (e.status === 401) setUser(null);
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (user) {
      let live = true;
      api("/workspace")
        .then((r) => {
          if (live) setData(r);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
      return () => {
        live = false;
      };
    }
  }, [user]);
  useEffect(() => {
    document.title =
      "EMS · " +
      (!user
        ? location.pathname === "/signup"
          ? "Create your workspace"
          : "Sign in"
        : !user.onboarding_complete || !user.workspace.setup_complete
          ? "Workspace setup"
          : page[0].toUpperCase() + page.slice(1));
    if (user) document.getElementById("main")?.focus({ preventScroll: true });
  }, [page, user]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const admin = user?.role === "admin",
    people = data.users,
    tasks = data.tasks;
  const owner = (id) => people.find((u) => u.id === id)?.name || "Team member";
  const open = tasks.filter((t) => !["completed", "failed"].includes(t.status)),
    completed = tasks.filter((t) => t.status === "completed").length;
  const d = new Date(),
    today = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  const overdue = open.filter((t) => t.due < today).length;
  const filtered = tasks.filter(
    (t) =>
      (filter === "all" || t.status === filter) &&
      (t.title + " " + t.category + " " + owner(t.assignee))
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function show(type) {
    setFormError("");
    setModal(type);
  }
  async function mutate(path, method, body, success) {
    setBusy(true);
    setFormError("");
    try {
      await api(path, { method, body });
      await refresh();
      setNotice(success);
      setModal(null);
      return true;
    } catch (e) {
      setFormError(e.message);
      if (!modal) setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function save(e, path, success) {
    e.preventDefault();
    await mutate(
      path,
      "POST",
      Object.fromEntries(new FormData(e.currentTarget)),
      success,
    );
  }
  async function logout() {
    try {
      await api("/logout", { method: "POST" });
      setUser(null);
      setData({ users: [], tasks: [], activity: [] });
      setPage("overview");
    } catch (e) {
      setError(e.message);
    }
  }
  function exportCSV() {
    const quote = (v) =>
      '"' +
      String(v)
        .replace(/^[=+@-]/, "'")
        .replaceAll('"', '""') +
      '"';
    const rows = [
      ["Title", "Assignee", "Status", "Priority", "Due date", "Category"],
      ...filtered.map((t) => [
        t.title,
        owner(t.assignee),
        states[t.status],
        t.priority,
        t.due,
        t.category,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((r) => r.map(quote).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "ems-tasks.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function activity(items) {
    return items.map((a) => (
      <div className="activity-row" key={a.id}>
        <span className="mini-avatar">{initials(a.name)}</span>
        <div>
          <strong>{a.name}</strong>
          <p>{a.message}</p>
        </div>
        <time>
          {new Date(a.created.replace(" ", "T") + "Z").toLocaleString()}
        </time>
      </div>
    ));
  }
  function card(t) {
    return (
      <button key={t.id} className="task-card" onClick={() => show(t)}>
        <div className="task-meta">
          <span>{t.category}</span>
          <span className={"priority " + t.priority}>{t.priority}</span>
        </div>
        <h3>{t.title}</h3>
        <p>{t.description}</p>
        <div className="card-foot">
          <span className="mini-avatar">{initials(owner(t.assignee))}</span>
          <span>{owner(t.assignee)}</span>
          <time dateTime={t.due}>{date(t.due)}</time>
        </div>
      </button>
    );
  }
  if (boot)
    return (
      <main className="boot" role="status">
        Opening your workspace…
      </main>
    );
  if (!user || ["/signup", "/login"].includes(location.pathname))
    return (
      <>
        <Login signup={location.pathname === "/signup"} onLogin={setUser} />
        {error && (
          <div className="connection-error" role="alert">
            {error}
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}
      </>
    );
  if (!user.onboarding_complete || !user.workspace.setup_complete)
    return <Setup user={user} onComplete={setUser} onLogout={logout} />;
  return (
    <div className="workspace">
      <a href="#main" className="skip">
        Skip to content
      </a>
      <aside className="sidebar">
        <a href="/" className="brand">
          e<span>ems</span>
        </a>
        <div className="workspace-label">
          <span className="workspace-monogram">W</span>
          <div>
            <strong>{user.workspace.name}</strong>
            <small>Team workspace</small>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Workspace">
          {[
            "overview",
            "tasks",
            ...(admin ? ["team"] : []),
            "activity",
            "settings",
          ].map((item) => (
            <button
              key={item}
              aria-current={page === item ? "page" : undefined}
              className={page === item ? "selected" : ""}
              onClick={() => {
                setPage(item);
                setQuery("");
                setFilter("all");
              }}
            >
              <span aria-hidden="true">
                {
                  {
                    overview: <LayoutDashboard size={18} />,
                    tasks: <ListTodo size={18} />,
                    team: <UsersRound size={18} />,
                    activity: <History size={18} />,
                    settings: <Settings size={18} />,
                  }[item]
                }
              </span>
              {item[0].toUpperCase() + item.slice(1)}
              {item === "tasks" && <small>{open.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          ● ALL IN A DAY’S WORK
          <p>
            Small steps.
            <br />
            Meaningful progress.
          </p>
        </div>
        <div className="profile">
          <span className="avatar">{initials(user.name)}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{admin ? "Administrator" : "Employee"}</small>
          </div>
          <button
            className="icon-button"
            title="Sign out"
            aria-label="Sign out"
            onClick={logout}
          >
            ↗
          </button>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span>{" "}
            <strong>{page[0].toUpperCase() + page.slice(1)}</strong>
          </span>
          <div>
            <span className="top-date">
              {new Date().toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <button className="secondary signout" onClick={logout}>
              Sign out
            </button>
            <span className="avatar small">{initials(user.name)}</span>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="main">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {page === "overview" ? "THE BIG PICTURE" : "YOUR WORKSPACE"}
              </p>
              <h1>
                {page === "overview"
                  ? `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${user.name.split(" ")[0]}.`
                  : page === "tasks"
                    ? "The work, in focus."
                    : page === "team"
                      ? "People make it happen."
                      : page === "activity"
                        ? "The latest, together."
                        : "Make yourself at home."}
              </h1>
              <p className="muted">
                {page === "overview"
                  ? "Here’s where things stand. Let’s make today count."
                  : page === "tasks"
                    ? "Clear priorities. Shared progress. One task at a time."
                    : page === "team"
                      ? "Your team, their roles, and the work ahead."
                      : page === "activity"
                        ? "A running record of what’s moving in your workspace."
                        : "Your profile and account security."}
              </p>
            </div>
            {admin && ["overview", "tasks", "team"].includes(page) && (
              <button
                className="primary"
                onClick={() => show(page === "team" ? "employee" : "task")}
              >
                ＋ {page === "team" ? "Add employee" : "Create task"}
              </button>
            )}
          </div>
          {notice && (
            <div className="notice" role="status">
              ✓ {notice}
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error} <button onClick={refresh}>Try again</button>
            </div>
          )}
          {loading && (
            <p role="status" className="muted">
              Refreshing workspace…
            </p>
          )}
          {page === "overview" && (
            <>
              <section className="stats" aria-label="Task summary">
                {[
                  ["Total tasks", tasks.length, "Everything on the table", "↗"],
                  [
                    "In progress",
                    tasks.filter((t) => t.status === "active").length,
                    "Work finding its rhythm",
                    "◷",
                  ],
                  ["Completed", completed, "A little closer to the goal", "✓"],
                  [
                    "Needs attention",
                    overdue,
                    "Open tasks past their due date",
                    "!",
                  ],
                ].map(([label, n, caption, icon]) => (
                  <div className="stat" key={label}>
                    <div>
                      <span>{label}</span>
                      <span className="stat-icon" aria-hidden="true">
                        {icon}
                      </span>
                    </div>
                    <strong>{String(n).padStart(2, "0")}</strong>
                    <small>{caption}</small>
                  </div>
                ))}
              </section>
              <div className="overview-grid">
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <h2>On the radar</h2>
                      <p className="muted">
                        The next things that need a little momentum.
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setPage("tasks")}
                    >
                      All tasks ↗
                    </button>
                  </div>
                  {open.length ? (
                    <div className="radar-list">
                      {[...open]
                        .sort((a, b) => a.due.localeCompare(b.due))
                        .slice(0, 5)
                        .map((t) => (
                          <button
                            className="radar-row"
                            key={t.id}
                            onClick={() => show(t)}
                          >
                            <span className={"status-dot " + t.status} />
                            <div>
                              <strong>{t.title}</strong>
                              <small>
                                {owner(t.assignee)} · {t.category}
                              </small>
                            </div>
                            <span className={"badge " + t.status}>
                              {states[t.status]}
                            </span>
                            <time dateTime={t.due}>{date(t.due)}</time>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <div className="empty">
                      All clear.{" "}
                      {admin
                        ? "Create a task to get things moving."
                        : "Your tasks will appear here."}
                    </div>
                  )}
                </section>
                <section className="progress-panel">
                  <span className="eyebrow">STEADY DOES IT</span>
                  <h2>
                    Every finished task <br />
                    moves us forward.
                  </h2>
                  <div className="progress-number">
                    {tasks.length
                      ? Math.round((completed / tasks.length) * 100)
                      : 0}
                    <span>%</span>
                  </div>
                  <progress
                    aria-label="Tasks completed"
                    max={tasks.length || 1}
                    value={completed}
                  />
                  <p>
                    {completed} of {tasks.length} tasks completed
                  </p>
                  <span className="progress-foot">ONE THING AT A TIME. →</span>
                </section>
              </div>
              <section className="panel">
                <div className="section-heading">
                  <h2>Around the workspace</h2>
                  <button
                    className="text-button"
                    onClick={() => setPage("activity")}
                  >
                    View activity ↗
                  </button>
                </div>
                {activity(data.activity.slice(0, 3))}
                {!data.activity.length && (
                  <p className="empty">Your next update starts here.</p>
                )}
              </section>
            </>
          )}
          {page === "tasks" && (
            <section className="panel">
              <div className="toolbar">
                <div className="filters">
                  {["all", ...Object.keys(states)].map((s) => (
                    <button
                      key={s}
                      aria-pressed={filter === s}
                      className={filter === s ? "active" : ""}
                      onClick={() => setFilter(s)}
                    >
                      {s === "all" ? "All tasks" : states[s]}{" "}
                      <small>
                        {s === "all"
                          ? tasks.length
                          : tasks.filter((t) => t.status === s).length}
                      </small>
                    </button>
                  ))}
                </div>
                <div className="task-tools">
                  <input
                    aria-label="Search tasks"
                    placeholder="Search tasks or people…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button
                    className="secondary"
                    onClick={() => setView(view === "list" ? "board" : "list")}
                  >
                    {view === "list" ? "Board view" : "List view"}
                  </button>
                  <button className="secondary" onClick={exportCSV}>
                    Export CSV
                  </button>
                </div>
              </div>
              {filtered.length ? (
                view === "board" ? (
                  <div className="board">
                    {Object.entries(states).map(([status, label]) => (
                      <section key={status}>
                        <h2>
                          {label}{" "}
                          <small>
                            {filtered.filter((t) => t.status === status).length}
                          </small>
                        </h2>
                        {filtered.filter((t) => t.status === status).map(card)}
                      </section>
                    ))}
                  </div>
                ) : (
                  <div
                    className="table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Task table, scroll horizontally for more columns"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Task</th>
                          <th>Assignee</th>
                          <th>Status</th>
                          <th>Priority</th>
                          <th>Due date</th>
                          <th>
                            <span className="sr-only">Details</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((t) => (
                          <tr key={t.id}>
                            <td>
                              <button
                                className="task-title"
                                onClick={() => show(t)}
                              >
                                {t.title}
                              </button>
                              <small className="table-category">
                                {t.category}
                              </small>
                            </td>
                            <td>{owner(t.assignee)}</td>
                            <td>
                              <span className={"badge " + t.status}>
                                {states[t.status]}
                              </span>
                            </td>
                            <td>
                              <span className={"priority " + t.priority}>
                                {t.priority}
                              </span>
                            </td>
                            <td>
                              <time dateTime={t.due}>{date(t.due)}</time>
                              {t.due < today &&
                                !["completed", "failed"].includes(t.status) && (
                                  <small className="overdue">Overdue</small>
                                )}
                            </td>
                            <td>
                              <button
                                className="icon-button"
                                aria-label={"View " + t.title}
                                onClick={() => show(t)}
                              >
                                ↗
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <div className="empty">
                  <h3>No tasks here yet.</h3>
                  <p>
                    {tasks.length
                      ? "Try another filter or search term."
                      : admin
                        ? "Create your first task to get the team moving."
                        : "Your assigned tasks will appear here."}
                  </p>
                </div>
              )}
            </section>
          )}
          {page === "team" && admin && (
            <>
              <div className="team-toolbar">
                <span>
                  {
                    people.filter((u) => u.role === "employee" && u.active)
                      .length
                  }{" "}
                  active employees
                </span>
                <input
                  aria-label="Search employees"
                  placeholder="Find a team member…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <section className="team-grid">
                {people
                  .filter((u) =>
                    (u.name + " " + u.email + " " + u.department)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((u) => (
                    <article className="person" key={u.id}>
                      <div className="person-top">
                        <span className="avatar large">{initials(u.name)}</span>
                        <span
                          className={
                            "badge " + (u.active ? "completed" : "failed")
                          }
                        >
                          {u.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <h2>{u.name}</h2>
                      <p>{u.email}</p>
                      <span className="department">
                        {u.department} ·{" "}
                        {u.role === "admin" ? "Admin" : "Employee"}
                      </span>
                      <div className="person-bottom">
                        <span>
                          <strong>
                            {
                              tasks.filter(
                                (t) =>
                                  t.assignee === u.id &&
                                  !["completed", "failed"].includes(t.status),
                              ).length
                            }
                          </strong>{" "}
                          open tasks
                        </span>
                        {u.role === "employee" && (
                          <button
                            className="text-button"
                            onClick={() => show({ employee: u })}
                          >
                            {u.active ? "Deactivate" : "Reactivate"}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
              </section>
            </>
          )}
          {page === "activity" && (
            <section className="panel activity-feed">
              <div className="section-heading">
                <h2>Recent activity</h2>
                <button className="text-button" onClick={refresh}>
                  Refresh ↻
                </button>
              </div>
              {activity(data.activity)}
              {!data.activity.length && (
                <p className="empty">
                  No updates yet. Task changes will appear here.
                </p>
              )}
              <p className="feed-note">
                Showing the latest 20 workspace updates.
              </p>
            </section>
          )}
          {page === "settings" && (
            <div className="settings-grid">
              <section className="panel settings-card">
                <h2>Your profile</h2>
                <span className="avatar large">{initials(user.name)}</span>
                <dl>
                  <dt>Name</dt>
                  <dd>{user.name}</dd>
                  <dt>Email</dt>
                  <dd>{user.email}</dd>
                  <dt>Department</dt>
                  <dd>{user.department}</dd>
                  <dt>Role</dt>
                  <dd>{admin ? "Administrator" : "Employee"}</dd>
                </dl>
              </section>
              <section className="panel settings-card">
                <h2>
                  {user.password_enabled ? "Change password" : "Social sign-in"}
                </h2>
                <p className="muted">
                  Choose at least 10 characters. Other sessions will be signed
                  out.
                </p>
                {user.password_enabled ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const values = Object.fromEntries(new FormData(form));
                      if (values.password !== values.confirm) {
                        setError("New passwords do not match. Re-enter them.");
                        return;
                      }
                      if (
                        await mutate(
                          "/password",
                          "POST",
                          values,
                          "Password updated.",
                        )
                      )
                        form.reset();
                    }}
                  >
                    <Field label="Current password">
                      <input
                        name="current"
                        type="password"
                        autoComplete="current-password"
                        maxLength={128}
                        required
                      />
                    </Field>
                    <Field label="New password">
                      <input
                        name="password"
                        type="password"
                        minLength={10}
                        maxLength={128}
                        autoComplete="new-password"
                        required
                      />
                    </Field>
                    <Field label="Confirm new password">
                      <input
                        name="confirm"
                        type="password"
                        minLength={10}
                        maxLength={128}
                        autoComplete="new-password"
                        required
                      />
                    </Field>
                    <button className="primary" disabled={busy}>
                      Update password
                    </button>
                  </form>
                ) : (
                  <p className="muted">
                    Use the same Google account you used when signing up. Your
                    password stays with that provider.
                  </p>
                )}
              </section>
            </div>
          )}
          <footer className="page-footer">
            <span>EMS — PEOPLE. PRIORITIES. PROGRESS.</span>
            <span>A little more clarity, every day.</span>
          </footer>
        </main>
      </div>
      {modal && (
        <Modal
          key={
            typeof modal === "string"
              ? modal
              : modal.edit
                ? "edit"
                : modal.delete
                  ? "delete"
                  : modal.employee
                    ? "employee-access"
                    : modal.id
          }
          title={
            modal?.edit
              ? "Edit task"
              : modal === "task"
                ? "Make the next move."
                : modal === "employee"
                  ? "Grow your team."
                  : modal.employee
                    ? "Update employee access"
                    : modal.delete
                      ? "Delete this task?"
                      : modal.title
          }
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          {modal === "task" || modal.edit ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate(
                  modal.edit ? "/tasks/" + modal.edit.id : "/tasks",
                  modal.edit ? "PUT" : "POST",
                  Object.fromEntries(new FormData(e.currentTarget)),
                  modal.edit
                    ? "Task updated."
                    : "Task assigned. Your team is ready.",
                );
              }}
            >
              <Field label="Task title">
                <input
                  name="title"
                  defaultValue={modal.edit?.title}
                  required
                  maxLength={120}
                  placeholder="What needs to happen?"
                  autoFocus
                />
              </Field>
              <Field label="Description">
                <textarea
                  name="description"
                  defaultValue={modal.edit?.description}
                  required
                  maxLength={2000}
                  rows={4}
                  placeholder="Add context and the expected outcome"
                />
              </Field>
              <div className="form-grid">
                <Field label="Assign to">
                  <select
                    name="assignee"
                    required
                    defaultValue={modal.edit?.assignee || ""}
                  >
                    <option value="" disabled>
                      Select employee
                    </option>
                    {people
                      .filter((u) => u.role === "employee" && u.active)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Due date">
                  <input
                    name="due"
                    type="date"
                    defaultValue={modal.edit?.due}
                    required
                  />
                </Field>
                <Field label="Priority">
                  <select
                    name="priority"
                    defaultValue={modal.edit?.priority || "medium"}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </Field>
                <Field label="Category">
                  <input
                    name="category"
                    defaultValue={modal.edit?.category}
                    required
                    maxLength={50}
                    placeholder="e.g. Engineering"
                  />
                </Field>
              </div>
              {formError && (
                <p role="alert" className="error">
                  {formError}
                </p>
              )}
              <button className="primary full" disabled={busy}>
                {busy ? "Saving…" : modal.edit ? "Save changes" : "Assign task"}
              </button>
            </form>
          ) : modal === "employee" ? (
            <form
              onSubmit={(e) =>
                save(e, "/users", "Employee added to your workspace.")
              }
            >
              <Field label="Full name">
                <input name="name" maxLength={80} required autoFocus />
              </Field>
              <Field label="Email address">
                <input name="email" type="email" required />
              </Field>
              <Field label="Department">
                <input name="department" maxLength={60} required />
              </Field>
              <Field label="Temporary password (at least 10 characters)">
                <input
                  name="password"
                  type="password"
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />
              </Field>
              <p className="muted">
                Share credentials securely. The employee can change their
                password in Settings.
              </p>
              {formError && (
                <p role="alert" className="error">
                  {formError}
                </p>
              )}
              <button className="primary full" disabled={busy}>
                Add employee
              </button>
            </form>
          ) : modal.employee ? (
            <>
              <p>
                {modal.employee.active
                  ? `Deactivate ${modal.employee.name}? They will be signed out and cannot log in. Their tasks and history will be retained.`
                  : `Restore workspace access for ${modal.employee.name}?`}
              </p>
              {formError && (
                <p role="alert" className="error">
                  {formError}
                </p>
              )}
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  mutate(
                    "/users/" + modal.employee.id,
                    "PATCH",
                    { active: !modal.employee.active },
                    "Employee access updated.",
                  )
                }
              >
                Confirm{" "}
                {modal.employee.active ? "deactivation" : "reactivation"}
              </button>
            </>
          ) : modal.delete ? (
            <>
              <p>
                “{modal.delete.title}” will be permanently removed. This cannot
                be undone.
              </p>
              {formError && (
                <p role="alert" className="error">
                  {formError}
                </p>
              )}
              <div className="modal-actions">
                <button className="secondary" onClick={() => setModal(null)}>
                  Keep task
                </button>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() =>
                    mutate(
                      "/tasks/" + modal.delete.id,
                      "DELETE",
                      undefined,
                      "Task deleted.",
                    )
                  }
                >
                  Delete task
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="detail-meta">
                <span className={"badge " + modal.status}>
                  {states[modal.status]}
                </span>
                <span className={"priority " + modal.priority}>
                  {modal.priority} priority
                </span>
              </div>
              <p className="task-description">{modal.description}</p>
              <dl className="detail-grid">
                <dt>Assigned to</dt>
                <dd>{owner(modal.assignee)}</dd>
                <dt>Due date</dt>
                <dd>{date(modal.due)}</dd>
                <dt>Category</dt>
                <dd>{modal.category}</dd>
              </dl>
              {formError && (
                <p role="alert" className="error">
                  {formError}
                </p>
              )}
              <div className="modal-actions">
                {admin ? (
                  <>
                    <Field label="Task status">
                      <select
                        value={modal.status}
                        disabled={busy}
                        onChange={(e) =>
                          mutate(
                            "/tasks/" + modal.id,
                            "PATCH",
                            { status: e.target.value },
                            "Task status updated.",
                          )
                        }
                      >
                        {Object.entries(states).map(([s, label]) => (
                          <option key={s} value={s}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => show({ edit: modal })}
                    >
                      Edit task
                    </button>
                    <button
                      className="danger-outline"
                      disabled={busy}
                      onClick={() => show({ delete: modal })}
                    >
                      Delete task
                    </button>
                  </>
                ) : modal.status === "new" ? (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      mutate(
                        "/tasks/" + modal.id,
                        "PATCH",
                        { status: "active" },
                        "Task accepted. You’ve got this.",
                      )
                    }
                  >
                    Accept task
                  </button>
                ) : modal.status === "active" ? (
                  <>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        mutate(
                          "/tasks/" + modal.id,
                          "PATCH",
                          { status: "completed" },
                          "Task completed. Nice work.",
                        )
                      }
                    >
                      Mark completed
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        mutate(
                          "/tasks/" + modal.id,
                          "PATCH",
                          { status: "failed" },
                          "Task marked as blocked.",
                        )
                      }
                    >
                      Mark blocked
                    </button>
                  </>
                ) : (
                  <p className="muted">
                    This task is {states[modal.status].toLowerCase()}. Ask your
                    administrator to reopen it if needed.
                  </p>
                )}
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
