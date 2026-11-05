import { useEffect, useState } from "react";
import { api } from "../api";
import Field from "./Field";
const oauthErrors = {
  expired:
    "This sign-in expired or started in another browser. Please try again.",
  cancelled: "Sign-in was cancelled. You can try again or use email.",
  existing:
    "An account already uses this email. Sign in with your original method.",
  unavailable:
    "This account is inactive. Contact your workspace administrator.",
  failed: "Social sign-in could not be completed. Try again or use email.",
};
export default function Login({ onLogin, signup = false }) {
  const [error, setError] = useState(
      () =>
        oauthErrors[new URLSearchParams(location.search).get("authError")] ||
        "",
    ),
    [busy, setBusy] = useState(false),
    [providers, setProviders] = useState([]);
  useEffect(() => {
    api("/auth/config")
      .then((data) => setProviders(data.providers))
      .catch(() => {});
  }, []);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    if (signup && values.password !== values.confirm) {
      setError("Passwords do not match. Re-enter them.");
      setBusy(false);
      return;
    }
    try {
      const data = await api(signup ? "/signup" : "/login", {
        method: "POST",
        body: values,
      });
      history.replaceState(null, "", "/");
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
          <span className="eyebrow">
            {signup ? "A FRESH START" : "YOUR WORKSPACE AWAITS"}
          </span>
          <h2>{signup ? "Room for good work." : "Welcome back."}</h2>
          <p className="muted">
            {signup
              ? "Create your account. Make the workspace yours."
              : "Sign in to see what’s moving."}
          </p>
          <div className="social-buttons">
            {providers.map((provider) => (
              <button
                key={provider.id}
                disabled={!provider.enabled || busy}
                className="secondary full"
                onClick={() => {
                  location.assign("/api/oauth/" + provider.id + "/start");
                }}
              >
                Continue with {provider.name}
              </button>
            ))}
          </div>
          {providers.length > 0 && !providers.some((p) => p.enabled) && (
            <p className="social-note">
              Social sign-in is not available here yet. Continue with email
              below.
            </p>
          )}
          <div className="auth-divider">
            <span>
              or {signup ? "create an account" : "sign in"} with email
            </span>
          </div>
          <form onSubmit={submit}>
            {signup && (
              <Field label="Your full name">
                <input
                  name="name"
                  autoComplete="name"
                  maxLength={80}
                  required
                  placeholder="e.g. Alex Morgan"
                />
              </Field>
            )}
            <Field label="Email address">
              <input
                name="email"
                type="email"
                autoComplete="username"
                maxLength={200}
                required
                placeholder="you@company.com"
              />
            </Field>
            <Field label="Password">
              <input
                name="password"
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={signup ? 10 : undefined}
                maxLength={128}
                required
                placeholder={
                  signup ? "At least 10 characters" : "Enter your password"
                }
              />
            </Field>
            {signup && (
              <Field label="Confirm password">
                <input
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                />
              </Field>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy
                ? "Please wait…"
                : signup
                  ? "Create account →"
                  : "Sign in to workspace →"}
            </button>
          </form>
          <p className="login-note">
            {signup ? "Already have an account?" : "New to EMS?"}{" "}
            <a className="inline-link" href={signup ? "/login" : "/signup"}>
              {signup ? "Sign in" : "Create your workspace"}
            </a>
          </p>
          {!signup && (
            <p className="login-note">
              Joining an existing team? Your administrator can add your account.
            </p>
          )}
        </div>
        <span className="login-bottom">
          EMS / PEOPLE. PRIORITIES. PROGRESS.
        </span>
      </section>
    </main>
  );
}
