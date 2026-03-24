"use server";

import { inferReceiptImageMime } from "@/lib/receipt-image";
import { uploadReceiptImage } from "@/lib/receipt-upload";

export async function uploadReceiptAction(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File)) {
    return { error: "No file provided" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = inferReceiptImageMime(file);

  try {
    const result = await uploadReceiptImage(buffer, mimeType);
    return { success: true, url: result.webViewLink };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to upload receipt",
    };
  }
}
