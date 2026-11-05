import { useState } from "react";
import { api } from "../api";
import Field from "./Field";
export default function Setup({ user, onComplete, onLogout }) {
  const [step, setStep] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [values, setValues] = useState({
    name: user.name,
    department: user.department === "General" ? "" : user.department,
    workspaceName: "",
    slug: "",
  });
  const workspaceNeeded =
    user.role === "admin" && !user.workspace.setup_complete;
  function update(e) {
    setError("");
    setValues({ ...values, [e.target.name]: e.target.value });
  }
  async function finish(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api("/setup", { method: "POST", body: values });
      onComplete(response.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="setup-page">
      <header className="setup-header">
        <a className="brand" href="/">
          e<span>ems</span>
        </a>
        <button className="text-button" onClick={onLogout}>
          Sign out
        </button>
      </header>
      <div className="setup-layout">
        <aside className="setup-story">
          <p className="eyebrow">LET’S MAKE THIS YOURS</p>
          <h1>
            Good work needs <br />a place to begin.
          </h1>
          <p>
            A few details now.
            <br />A clearer day ahead.
          </p>
          <ol className="setup-steps">
            <li className={step === 1 ? "current" : ""}>
              <span>01</span>
              <div>
                <strong>A little about you</strong>
                <small>Your name and your role in the team.</small>
              </div>
            </li>
            <li className={step === 2 ? "current" : ""}>
              <span>02</span>
              <div>
                <strong>
                  {workspaceNeeded ? "Your workspace" : "Ready to begin"}
                </strong>
                <small>
                  {workspaceNeeded
                    ? "Give your team a place to work."
                    : "A quick look before you start."}
                </small>
              </div>
            </li>
          </ol>
        </aside>
        <section className="setup-card">
          <p className="eyebrow">STEP {step} OF 2</p>
          <h2>
            {step === 1
              ? "First, a proper introduction."
              : workspaceNeeded
                ? "A home for your team."
                : "You’re in good company."}
          </h2>
          <p className="muted">
            {step === 1
              ? "Tell us what to call you and where you work."
              : workspaceNeeded
                ? "Choose a name and a unique workspace address."
                : "Your workspace is ready. Let’s get you settled in."}
          </p>
          {step === 1 ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError("");
                setStep(2);
              }}
            >
              <Field label="Your full name">
                <input
                  name="name"
                  value={values.name}
                  onChange={update}
                  maxLength={80}
                  autoComplete="name"
                  required
                />
              </Field>
              <Field label="Department">
                <input
                  name="department"
                  value={values.department}
                  onChange={update}
                  maxLength={60}
                  placeholder="e.g. Engineering"
                  required
                />
              </Field>
              <div className="setup-account">
                <span>ACCOUNT</span>
                <strong>{user.email}</strong>
                <small>Workspace administrator</small>
              </div>
              <button className="primary full">Continue →</button>
            </form>
          ) : (
            <form onSubmit={finish}>
              {workspaceNeeded ? (
                <>
                  <Field label="Workspace name">
                    <input
                      name="workspaceName"
                      value={values.workspaceName}
                      onChange={update}
                      maxLength={80}
                      required
                      placeholder="e.g. Northstar Studio"
                      autoFocus
                    />
                  </Field>
                  <Field label="Workspace address">
                    <div className="slug-field">
                      <span>ems /</span>
                      <input
                        name="slug"
                        value={values.slug}
                        onChange={(e) => {
                          setError("");
                          setValues({
                            ...values,
                            slug: e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, ""),
                          });
                        }}
                        pattern="[a-z0-9][a-z0-9-]{2,49}"
                        minLength={3}
                        maxLength={50}
                        required
                        placeholder="northstar-studio"
                      />
                    </div>
                  </Field>
                  <p className="muted">
                    Use 3–50 lowercase letters, numbers or hyphens. This
                    identifies your workspace.
                  </p>
                </>
              ) : (
                <div className="setup-account">
                  <strong>{user.workspace.name}</strong>
                  <p>
                    {values.name} · {values.department}
                  </p>
                </div>
              )}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button className="primary full" disabled={busy}>
                {busy ? "Setting things up…" : "Open my workspace →"}
              </button>
              <button
                type="button"
                className="text-button full"
                disabled={busy}
                onClick={() => setStep(1)}
              >
                ← Back to your details
              </button>
            </form>
          )}
        </section>
      </div>
      <footer className="setup-footer">ONE TEAM. A LITTLE MORE CLARITY.</footer>
    </main>
  );
}
