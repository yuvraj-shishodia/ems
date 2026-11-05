import { useState } from "react";
import { api } from "../api";
import Field from "./Field";
export default function Login({ onLogin }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api("/login", {
        method: "POST",
        body: Object.fromEntries(new FormData(e.currentTarget)),
      });
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <section className="login-story">
        <a className="brand" href="/">
          e<span>ems</span>
          <small>TEAM WORKSPACE</small>
        </a>
        <div>
          <p className="eyebrow">GOOD WORK STARTS WITH CLARITY</p>
          <h1>
            A little structure.
            <br />A lot of progress.
          </h1>
          <p>
            One place for your people, their priorities,
            <br />
            and the work that moves you forward.
          </p>
          <div className="story-line">
            <span>01 / PEOPLE</span>
            <span>02 / PRIORITIES</span>
            <span>03 / PROGRESS</span>
          </div>
        </div>
        <p className="story-footer">Make room for your best work.</p>
      </section>
      <section className="login-panel">
        <div className="login-form">
          <span className="eyebrow">YOUR WORKSPACE AWAITS</span>
          <h2>Welcome back.</h2>
          <p className="muted">Sign in to see what’s moving.</p>
          <form onSubmit={submit}>
            <Field label="Email address">
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="you@company.com"
              />
            </Field>
            <Field label="Password">
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                required
                placeholder="Enter your password"
              />
            </Field>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to workspace →"}
            </button>
          </form>
          <p className="login-note">
            Need access? Ask your workspace administrator.
          </p>
        </div>
        <span className="login-bottom">EMS / A FOCUSED WAY TO WORK</span>
      </section>
    </main>
  );
}
