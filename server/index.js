import { resolve } from "node:path";
import { openStore, seed } from "./store.js";
import { createProviders } from "./oauth.js";
import { createApp } from "./app.js";
const production = process.env.NODE_ENV === "production";
const db = openStore(process.env.DATABASE_PATH || resolve("data/ems.sqlite"));
if (process.env.SEED_DEMO === "true") {
  if (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 10)
    throw new Error(
      "Set DEMO_PASSWORD to at least 10 characters before seeding.",
    );
  seed(db, process.env.DEMO_PASSWORD);
}
const providers = createProviders();
const appUrl = process.env.APP_URL || "http://127.0.0.1:3001";
const server = createApp(db, { production, providers, appUrl });

const port = Number(process.env.PORT) || 3001;
server.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(
    `EMS is running on http://${process.env.HOST || "127.0.0.1"}:${port}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
