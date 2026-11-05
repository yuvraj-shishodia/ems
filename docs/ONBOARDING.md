# Signup, onboarding and Google sign-in

## Included flows

1. Email/password signup creates an administrator and a private, empty workspace.
2. Two-step onboarding collects the administrator profile, department, workspace name and unique workspace address.
3. Returning users resume unfinished setup; completed workspaces open the dashboard.
4. Google signup/sign-in uses the same onboarding path. Existing Google identities return to their existing workspace.
5. Workspace reads and employee/task changes are scoped on the server. A database trigger also prevents assigning a task to a user from a different workspace.

Existing demo data, account passwords and sessions are preserved by the additive database migration. The legacy workspace is named Workplace. There is no email service, email verification, invitation flow, access-request flow or password-recovery flow in this change.

## Google configuration

Google sign-in requires an OAuth client belonging to the application owner. No Google credentials are included in this repository. Without configuration, the Google button remains unavailable and email signup still works.

Create an OAuth client of type **Web application** in your Google Cloud project. Configure the consent screen; if the app is in testing mode, add the intended test users. Do not enter passwords or approve consent on someone else's behalf.

For the local built app, register this exact authorized redirect URI:

```text
http://127.0.0.1:3001/api/oauth/google/callback
```

Set these in your untracked `.env`:

```dotenv
APP_URL=http://127.0.0.1:3001
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Fill the last two values with your client credentials, then restart the backend. Never commit the secret. For Vite development, set `APP_URL` to the Vite origin (usually `http://localhost:5173`) and register the corresponding `/api/oauth/google/callback` redirect URI. Use one consistent origin; `localhost` and `127.0.0.1` are different hosts.

For a public deployment, use an HTTPS `APP_URL`, register its exact callback URI, and set `NODE_ENV=production`. The OAuth consent screen and provider configuration are account-owner steps; a real Google account round trip has not been exercised without those credentials.

## Security decisions

- Google authorization code flow uses PKCE S256, browser-bound state, a nonce and ten-minute expiry.
- State is consumed before code exchange. Missing, expired, mismatched and replayed state is rejected.
- ID tokens require a valid Google signature, issuer, audience, expiry, recent issue time, matching nonce and verified email.
- Provider tokens are never returned to the browser or stored as application sessions. EMS issues its own HttpOnly cookie.
- Existing accounts are identified by Google subject, not by a mutable email address. A matching email does not silently link to a password account; the user must use their original sign-in method.
- Google accounts do not have a usable local password. Settings explains that sign-in remains with Google.
- Email/password signup does not claim to verify the address. Passwords use salted scrypt hashes; duplicate addresses are rejected.
- Before completing setup, administrators cannot create employees or tasks. The server does not trust a workspace ID submitted by the browser.
- One identity belongs to one workspace. Workspace switching and sign-in method linking are not included.

## Endpoints

| Method | Endpoint                     | Purpose                                                   |
| ------ | ---------------------------- | --------------------------------------------------------- |
| GET    | `/api/auth/config`           | Available sign-in methods; never secrets                  |
| POST   | `/api/signup`                | `{name,email,password}`; create account/session           |
| POST   | `/api/setup`                 | `{name,department,workspaceName,slug}`; finish onboarding |
| GET    | `/api/oauth/google/start`    | Start a browser-bound Google flow                         |
| GET    | `/api/oauth/google/callback` | Validate provider callback; redirect to app               |

## Verification

`npm test` covers signup, setup, duplicate emails, workspace URL conflicts, tenant isolation, migration preservation, returning Google identities, PKCE/state replay, email collision refusal and signed ID-token validation. Provider code exchange is mocked in integration tests; token verification uses real generated RSA keys.

`npm run test:e2e` covers the email signup/setup path, unfinished setup on reload, duplicate email/password errors, accessibility and mobile layout. Live Google sign-in requires the owner configuration described above.

References: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Google OIDC reference](https://developers.google.com/identity/openid-connect/reference), [jose](https://github.com/panva/jose).
