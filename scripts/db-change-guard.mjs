#!/usr/bin/env node
/**
 * Guarded DB mutation workflow for Google Sheets:
 * - snapshot before
 * - run change command
 * - snapshot after
 * - verify against allowlist
 * - delete before snapshot when clean
 *
 * Usage:
 *   node scripts/db-change-guard.mjs \
 *     --run "node scripts/some-mutation.mjs --apply" \
 *     --allow scripts/db-change-allow.json \
 *     --label "set-april-fixed-monthly"
 */

import { spawn } from "child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";
import { google } from "googleapis";

const PROJECT_ROOT = process.cwd();
const SNAPSHOT_DIR = resolve(PROJECT_ROOT, ".db-snapshots");

const SHEETS_TO_CAPTURE = [
  "Customers",
  "Bills",
  "Payments",
  "Settings",
  "AmperePrices",
  "MonthlyTariffs",
  "CustomerBillingHistory",
  "BillingChangeLog",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const run = get("--run");
  const allowPath = get("--allow");
  const label = get("--label") || "db-change";
  if (!run) {
    throw new Error(
      'Missing --run command. Example: --run "node scripts/recalculate-all-bills.mjs"'
    );
  }
  return { run, allowPath, label };
}

function loadEnv() {
  for (const name of [".env", ".env.local"]) {
    try {
      const content = readFileSync(resolve(PROJECT_ROOT, name), "utf-8");
      for (const line of content.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (!m) continue;
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    } catch {}
  }
}

function norm(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function rowKey(sheetName, header, row, rowIndex) {
  const h = header.map(norm);
  const idx = (name) => h.findIndex((x) => x === norm(name));
  const by = (name) => String(row[idx(name)] || "").trim();

  if (sheetName === "Customers") return by("customerId") || `__row_${rowIndex}`;
  if (sheetName === "Bills") return by("billId") || `__row_${rowIndex}`;
  if (sheetName === "Payments") return by("paymentId") || `__row_${rowIndex}`;
  if (sheetName === "CustomerBillingHistory") return by("entryId") || `__row_${rowIndex}`;
  if (sheetName === "BillingChangeLog") return by("logId") || `__row_${rowIndex}`;
  if (sheetName === "MonthlyTariffs") return by("monthKey") || `__row_${rowIndex}`;
  if (sheetName === "AmperePrices") return by("amp") || `__row_${rowIndex}`;

  // Settings and any unknown sheet: keep deterministic row-based key.
  return `__row_${rowIndex}`;
}

async function getSheetsClient() {
  loadEnv();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error("Missing GOOGLE_SHEETS_ID");

  const credPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "./station-490108-55c52b942e8e.json";
  const creds = JSON.parse(readFileSync(resolve(PROJECT_ROOT, credPath), "utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  return { sheets, spreadsheetId };
}

async function captureSnapshot(label) {
  const { sheets, spreadsheetId } = await getSheetsClient();
  const snapshot = {
    takenAt: new Date().toISOString(),
    label,
    spreadsheetId,
    sheets: {},
  };

  for (const name of SHEETS_TO_CAPTURE) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${name}!A:Z`,
    });
    const values = res.data.values || [];
    const header = values[0] || [];
    const rows = values.slice(1);
    snapshot.sheets[name] = {
      header,
      rows,
    };
  }
  return snapshot;
}

function buildRowMap(sheetName, sheetData) {
  const map = new Map();
  const header = sheetData.header || [];
  const rows = sheetData.rows || [];
  rows.forEach((row, idx) => {
    map.set(rowKey(sheetName, header, row, idx + 2), row);
  });
  return map;
}

function diffSnapshots(before, after) {
  const diffs = [];
  for (const sheetName of SHEETS_TO_CAPTURE) {
    const beforeSheet = before.sheets[sheetName] || { header: [], rows: [] };
    const afterSheet = after.sheets[sheetName] || { header: [], rows: [] };
    const header = (afterSheet.header?.length ? afterSheet.header : beforeSheet.header) || [];

    const beforeMap = buildRowMap(sheetName, beforeSheet);
    const afterMap = buildRowMap(sheetName, afterSheet);
    const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

    for (const key of keys) {
      const oldRow = beforeMap.get(key);
      const newRow = afterMap.get(key);

      if (!oldRow && newRow) {
        diffs.push({ sheet: sheetName, key, kind: "row_added", column: "*", before: "", after: "" });
        continue;
      }
      if (oldRow && !newRow) {
        diffs.push({ sheet: sheetName, key, kind: "row_removed", column: "*", before: "", after: "" });
        continue;
      }

      const width = Math.max(oldRow.length, newRow.length, header.length);
      for (let i = 0; i < width; i++) {
        const oldVal = String(oldRow[i] ?? "");
        const newVal = String(newRow[i] ?? "");
        if (oldVal === newVal) continue;
        diffs.push({
          sheet: sheetName,
          key,
          kind: "cell_updated",
          column: header[i] || `col_${i + 1}`,
          before: oldVal,
          after: newVal,
        });
      }
    }
  }
  return diffs;
}

function loadAllowlist(pathMaybe) {
  if (!pathMaybe) return [];
  const full = resolve(PROJECT_ROOT, pathMaybe);
  const json = JSON.parse(readFileSync(full, "utf-8"));
  const entries = Array.isArray(json) ? json : Array.isArray(json.allow) ? json.allow : [];
  return entries.map((x) => ({
    sheet: x.sheet ? String(x.sheet) : undefined,
    key: x.key ? String(x.key) : undefined,
    keyPrefix: x.keyPrefix ? String(x.keyPrefix) : undefined,
    column: x.column ? String(x.column) : undefined,
    kind: x.kind ? String(x.kind) : undefined,
  }));
}

function isAllowed(change, allowlist) {
  if (allowlist.length === 0) return false;
  return allowlist.some((r) => {
    if (r.sheet && r.sheet !== change.sheet) return false;
    if (r.key && r.key !== change.key) return false;
    if (r.keyPrefix && !change.key.startsWith(r.keyPrefix)) return false;
    if (r.column && r.column !== change.column) return false;
    if (r.kind && r.kind !== change.kind) return false;
    return true;
  });
}

function runCommand(cmd) {
  return new Promise((resolveResult) => {
    const child = spawn(cmd, {
      cwd: PROJECT_ROOT,
      shell: true,
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => resolveResult(code ?? 1));
    child.on("error", () => resolveResult(1));
  });
}

async function main() {
  const { run, allowPath, label } = parseArgs();
  mkdirSync(SNAPSHOT_DIR, { recursive: true });

  const prefix = `${nowStamp()}-${label.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const beforePath = resolve(SNAPSHOT_DIR, `${prefix}-before.json`);
  const afterPath = resolve(SNAPSHOT_DIR, `${prefix}-after.json`);
  const latestPath = resolve(SNAPSHOT_DIR, "latest.json");
  const allowlist = loadAllowlist(allowPath);

  const before = await captureSnapshot(`${label}-before`);
  writeFileSync(beforePath, JSON.stringify(before, null, 2));

  const exitCode = await runCommand(run);
  if (exitCode !== 0) {
    console.error(`\nChange command failed (exit ${exitCode}). Snapshot kept: ${beforePath}`);
    process.exit(exitCode);
  }

  const after = await captureSnapshot(`${label}-after`);
  writeFileSync(afterPath, JSON.stringify(after, null, 2));

  const changes = diffSnapshots(before, after);
  const unexpected = changes.filter((c) => !isAllowed(c, allowlist));

  const bySheet = new Map();
  for (const c of changes) bySheet.set(c.sheet, (bySheet.get(c.sheet) || 0) + 1);

  console.log("\nDB change summary:");
  console.log(`- total changes: ${changes.length}`);
  console.log(`- sheets touched: ${[...bySheet.entries()].map(([s, n]) => `${s}(${n})`).join(", ") || "none"}`);
  console.log(`- unexpected changes: ${unexpected.length}`);

  if (unexpected.length > 0) {
    console.error("\nUnexpected changes detected. Keeping snapshots for investigation.");
    console.error(`- before: ${beforePath}`);
    console.error(`- after:  ${afterPath}`);
    console.error("- first unexpected entries:");
    for (const x of unexpected.slice(0, 25)) {
      console.error(
        `  ${x.sheet} | ${x.key} | ${x.column} | ${x.kind} | "${x.before}" -> "${x.after}"`
      );
    }
    process.exit(2);
  }

  // Verified good: delete previous snapshot as requested, keep latest baseline.
  rmSync(beforePath, { force: true });
  writeFileSync(latestPath, JSON.stringify(after, null, 2));
  console.log("\nVerified: only allowed changes detected.");
  console.log(`Deleted previous snapshot: ${beforePath}`);
  console.log(`Updated baseline snapshot: ${latestPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
