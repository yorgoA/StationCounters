/**
 * Receipt uploads: Vercel Blob only (BLOB_READ_WRITE_TOKEN required).
 * Images are optimized in optimizeReceiptImageBuffer before upload.
 */

import { put } from "@vercel/blob";
import { optimizeReceiptImageBuffer } from "@/lib/receipt-image";

/** Returned after upload (Blob URL or legacy Drive-shaped fields for the UI). */
export interface UploadReceiptResult {
  fileId: string;
  webViewLink: string;
  webContentLink?: string;
}

export async function uploadReceiptImage(
  buffer: Buffer,
  inputMimeType: string
): Promise<UploadReceiptResult> {
  const { buffer: out, mimeType, ext } = await optimizeReceiptImageBuffer(
    buffer,
    inputMimeType
  );
  const filename = `receipts/receipt_${Date.now()}.${ext}`;

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!blobToken) {
    throw new Error(
      "Receipt uploads require BLOB_READ_WRITE_TOKEN (Vercel Blob). Add it in .env.local or Vercel → Environment Variables."
    );
  }

  const blob = await put(filename, out, {
    access: "public",
    token: blobToken,
    contentType: mimeType,
  });

  return {
    fileId: blob.pathname,
    webViewLink: blob.url,
    webContentLink: blob.downloadUrl,
  };
}
