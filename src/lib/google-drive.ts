/**
 * Google Drive service - receipt image upload.
 * Server-side only.
 */

import { Readable } from "stream";
import { google } from "googleapis";
import { getGoogleAuth } from "./google-auth";

export interface UploadReceiptResult {
  fileId: string;
  webViewLink: string;
  webContentLink?: string;
}

export async function uploadReceipt(
  buffer: Buffer,
  filename: string,
  mimeType: string = "image/jpeg"
): Promise<UploadReceiptResult> {
  const folderId = process.env.GOOGLE_DRIVE_RECEIPTS_FOLDER_ID;
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_RECEIPTS_FOLDER_ID environment variable is required");
  }

  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  const fileMetadata = {
    name: filename,
    parents: [folderId],
  };

  const stream = Readable.from(buffer);
  const media = {
    mimeType,
    body: stream,
  };

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: "id, webViewLink, webContentLink",
  });

  const fileId = file.data.id;
  if (!fileId) throw new Error("Failed to create file in Drive");

  // Make file viewable by anyone with link (for MVP - receipt viewing)
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  const webViewLink = file.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
  const webContentLink = file.data.webContentLink;

  return {
    fileId,
    webViewLink,
    webContentLink: webContentLink || undefined,
  };
}
