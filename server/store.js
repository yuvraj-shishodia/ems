import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password, hash) {
  const [salt, key] = hash.split(":");
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(key, "hex"));
}
export function openStore(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','employee')),department TEXT NOT NULL DEFAULT 'General',active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,assignee INTEGER NOT NULL REFERENCES users(id),due TEXT NOT NULL,priority TEXT NOT NULL CHECK(priority IN ('low','medium','high')),status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','active','completed','failed')),category TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),message TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
  return db;
}
export function seed(db, password) {
  if (db.prepare("SELECT COUNT(*) AS n FROM users").get().n) return;
  const add = db.prepare(
    "INSERT INTO users(name,email,password,role,department) VALUES(?,?,?,?,?)",
  );
  const people = [
    ["Alex Morgan", "admin@ems.local", "admin", "Operations"],
    ["Jamie Chen", "jamie@ems.local", "employee", "Design"],
    ["Priya Shah", "priya@ems.local", "employee", "Engineering"],
    ["Sam Wilson", "sam@ems.local", "employee", "Marketing"],
  ];
  for (const [name, email, role, dept] of people)
    add.run(name, email, hashPassword(password), role, dept);
  const task = db.prepare(
    "INSERT INTO tasks(title,description,assignee,due,priority,status,category) VALUES(?,?,?,?,?,?,?)",
  );
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  for (const row of [
    [
      "Refresh the onboarding flow",
      "Map the first-run experience and prepare a clickable prototype.",
      2,
      day(3),
      "high",
      "active",
      "Design",
    ],
    [
      "Audit keyboard navigation",
      "Check focus order and document improvements for the next release.",
      3,
      day(2),
      "high",
      "new",
      "Accessibility",
    ],
    [
      "Plan the November newsletter",
      "Draft the product update and share a first version for review.",
      4,
      day(5),
      "medium",
      "new",
      "Marketing",
    ],
    [
      "Document the component library",
      "Write usage notes for the shared form and navigation components.",
      2,
      day(7),
      "low",
      "new",
      "Documentation",
    ],
    [
      "Ship the reporting endpoint",
      "Add pagination and permission checks to the reporting API.",
      3,
      day(-1),
      "medium",
      "completed",
      "Engineering",
    ],
    [
      "Review campaign results",
      "Summarise the last campaign and identify the next experiment.",
      4,
      day(-2),
      "medium",
      "failed",
      "Marketing",
    ],
  ])
    task.run(...row);
  db.prepare("INSERT INTO activity(user_id,message) VALUES(?,?)").run(
    1,
    "Workspace created. Your team is ready to go.",
  );
}
