import { spawn } from "node:child_process";
const children = [
  spawn(
    process.execPath,
    ["--env-file-if-exists=.env", "--watch", "server/index.js"],
    { stdio: "inherit" },
  ),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js"], {
    stdio: "inherit",
  }),
];
const stop = () => children.forEach((child) => child.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) child.on("exit", stop);
