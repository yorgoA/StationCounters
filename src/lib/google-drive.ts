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

/** Google client errors include API message in response body */
function googleApiMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "";
  const e = err as {
    message?: string;
    response?: { data?: { error?: { message?: string; errors?: { message?: string }[] } } };
  };
  const api = e.response?.data?.error;
  if (api?.message) return api.message;
  const first = api?.errors?.[0]?.message;
  if (first) return first;
  if (e.message) return e.message;
  return "";
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

  let file;
  try {
    file = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id, webViewLink, webContentLink",
      supportsAllDrives: true,
    });
  } catch (err) {
    const detail = googleApiMessage(err);
    throw new Error(
      detail
        ? `Drive upload failed: ${detail}`
        : "Drive upload failed (check folder ID, Shared Drive access, and service account permissions)."
    );
  }

  const fileId = file.data.id;
  if (!fileId) throw new Error("Failed to create file in Drive");

  // Make file viewable by anyone with link (for MVP - receipt viewing)
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });
  } catch (err) {
    const detail = googleApiMessage(err);
    throw new Error(
      detail
        ? `Receipt uploaded but sharing failed: ${detail}. If this started recently, a Google Workspace admin may have disabled “anyone with the link” for Drive, or the file may be on a Shared Drive with restricted sharing.`
        : "Receipt uploaded but could not set link sharing. Ask your Google Workspace admin about Drive sharing restrictions."
    );
  }

  const webViewLink = file.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
  const webContentLink = file.data.webContentLink;

  return {
    fileId,
    webViewLink,
    webContentLink: webContentLink || undefined,
  };
}
