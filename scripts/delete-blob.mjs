/**
 * Delete a blob by full public URL (same store as BLOB_READ_WRITE_TOKEN).
 *
 * Usage:
 *   node scripts/delete-blob.mjs "https://....vercel-storage.com/receipts/receipt_....jpg"
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { del } from "@vercel/blob";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function loadEnv() {
  try {
    const envPath = resolve(projectRoot, ".env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, "");
        process.env[key] = value;
      }
    }
  } catch {
    console.warn("Could not load .env.local");
  }
}

loadEnv();

const url = process.argv[2]?.trim();
if (!url || !url.startsWith("http")) {
  console.error("Usage: node scripts/delete-blob.mjs <full-blob-url>");
  process.exit(1);
}

const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
if (!token) {
  console.error("Missing BLOB_READ_WRITE_TOKEN in .env.local or environment.");
  process.exit(1);
}

try {
  await del(url, { token });
  console.log("Deleted:", url);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
