# Deployment

The repository includes a deployable single-process Node service. Deployment itself has not been performed.

## Host requirements

- Node.js 22.15 or later, or Docker.
- A persistent disk for the SQLite database. Ephemeral/serverless filesystems lose data.
- HTTPS terminating at a reverse proxy; forward the original Host header.
- One service replica. The in-memory login limiter is per process; a reverse proxy or shared limiter is needed before horizontally scaling.

## Environment

| Variable                             | Meaning                                                |
| ------------------------------------ | ------------------------------------------------------ |
| `NODE_ENV=production`                | Enables Secure session cookies; requires HTTPS         |
| `HOST=0.0.0.0`                       | Listen on the host�s network interface                 |
| `PORT=3001`                          | Listening port                                         |
| `DATABASE_PATH=/app/data/ems.sqlite` | Persistent database location                           |
| `SEED_DEMO=true`                     | Bootstrap fictional demo accounts on an empty database |
| `DEMO_PASSWORD`                      | Strong initial password; supply through host secrets   |

Run `npm ci`, `npm run build`, then `npm start`. After bootstrapping, disable `SEED_DEMO`, rotate each account password, and keep public demo data fictional. All seeded users initially share the configured password; use separate credentials for real users.

## Docker

```powershell
docker build -t ems .
docker volume create ems-data
docker run --env-file .env -e NODE_ENV=production -e HOST=0.0.0.0 -e DATABASE_PATH=/app/data/ems.sqlite -p 3001:3001 -v ems-data:/app/data ems
```

Place HTTPS in front of this container. For a local HTTP-only container preview, override `NODE_ENV=development`; this is not a public deployment configuration. The image runs as an unprivileged user and installs production dependencies, including jose for Google token verification. Docker configuration is supplied but has not been executed in this environment.

## Operations

- Check `/api/health` after startup.
- Back up with SQLite's online backup facilities or stop the process before copying the database and associated WAL files. Never copy just the live main file while writes are active.
- Restore into a separate location first and verify employee/task counts before replacing live data.
- Do not expose the database, `.env`, logs or repository as static files. The server serves only `dist/`.
- Put a request-rate and body-size limit on your reverse proxy. The application caps JSON bodies at 16 KB and failed logins at 10 per 15 minutes per direct client IP.
- Do not deploy several replicas behind one IP and assume the in-process rate limiter distinguishes forwarded clients. Configure a trusted proxy policy before using forwarded IP headers.

## Limits before real organizational use

Add schema migrations, administrator recovery, independently managed production accounts, monitoring, a backup retention policy and a shared rate limiter. Evaluate MFA and audit retention. This is a portfolio application, not a multi-tenant HR platform.

## Signup and Google sign-in

Set `APP_URL` to the public HTTPS origin. Configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` through host secrets and register the exact `/api/oauth/google/callback` redirect URI. See [onboarding](ONBOARDING.md). Email signup is usable without Google credentials. No SMTP configuration is needed. One account belongs to one workspace; no public email verification or recovery is included.
