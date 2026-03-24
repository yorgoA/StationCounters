#!/usr/bin/env node
/**
 * Shows what Google Drive API returns for GOOGLE_DRIVE_RECEIPTS_FOLDER_ID.
 * If driveId is empty, the folder is My Drive (not a Shared drive)—Drive API uploads
 * as a service account would fail. (The app uses Vercel Blob for receipts; this script is optional.)
 *
 * Usage: node scripts/verify-receipt-folder.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function loadEnv() {
  try {
    const c = readFileSync(resolve(projectRoot, ".env.local"), "utf-8");
    for (const line of c.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* optional */
  }
}

loadEnv();

const folderId = process.env.GOOGLE_DRIVE_RECEIPTS_FOLDER_ID?.trim();
const credPathRaw =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  resolve(projectRoot, "station-490108-55c52b942e8e.json");
const credPath = credPathRaw.startsWith("/")
  ? credPathRaw
  : resolve(projectRoot, credPathRaw);

async function main() {
  if (!folderId) {
    console.error("Set GOOGLE_DRIVE_RECEIPTS_FOLDER_ID in .env.local\n");
    process.exit(1);
  }

  const credentials = JSON.parse(readFileSync(credPath, "utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  const drive = google.drive({ version: "v3", auth: await auth.getClient() });

  const { data } = await drive.files.get({
    fileId: folderId,
    fields:
      "id,name,mimeType,driveId,parents,capabilities(canAddChildren),shortcutDetails",
    supportsAllDrives: true,
  });

  console.log("\n--- Google Drive API: your receipts folder ---\n");
  console.log(JSON.stringify(data, null, 2));
  console.log("\n--- How to read this ---\n");
  if (data.mimeType !== "application/vnd.google-apps.folder") {
    console.log("mimeType is not a folder — use a folder ID, not a file/sheet ID.\n");
  } else if (data.driveId) {
    console.log(
      `driveId is set (${data.driveId}) → folder is on a Shared drive. Uploads should be allowed if the service account is Content manager on that drive.\n`
    );
  } else {
    console.log(
      "driveId is MISSING → Google treats this as My Drive (personal storage).\n" +
        "Putting the folder next to your spreadsheet does NOT move it to a Shared drive.\n" +
        "Sheets API works with a shared spreadsheet; Drive file upload as a service account does NOT use your personal quota.\n\n" +
        "Fix: In Drive’s LEFT sidebar click “Shared drives” (Google Workspace). Create/open a team drive,\n" +
        "add the service account’s client_email as Content manager, create NEW folder only inside that drive,\n" +
        "copy that folder’s ID into GOOGLE_DRIVE_RECEIPTS_FOLDER_ID.\n\n" +
        "If you have no “Shared drives” menu, you need Google Workspace or another storage approach.\n"
    );
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
