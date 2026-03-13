/**
 * Google API authentication using service account.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { google } from "googleapis";

function getCredentials() {
  const jsonStr = process.env.GOOGLE_CREDENTIALS_JSON;
  if (jsonStr) {
    try {
      return JSON.parse(jsonStr);
    } catch {
      throw new Error("Invalid GOOGLE_CREDENTIALS_JSON in environment");
    }
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    try {
      const fullPath = credPath.startsWith("/")
        ? credPath
        : resolve(process.cwd(), credPath);
      return JSON.parse(readFileSync(fullPath, "utf-8"));
    } catch {
      throw new Error(`Could not load credentials from ${credPath}`);
    }
  }

  throw new Error(
    "Missing Google credentials. Set GOOGLE_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS"
  );
}

export function getGoogleAuth() {
  const credentials = getCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });
  return auth;
}
