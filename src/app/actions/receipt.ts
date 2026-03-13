"use server";

import { uploadReceipt } from "@/lib/google-drive";

export async function uploadReceiptAction(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File)) {
    return { error: "No file provided" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop() || "jpg";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  const mimeType = mimeMap[ext] || "image/jpeg";
  const filename = `receipt_${Date.now()}.${ext}`;

  try {
    const result = await uploadReceipt(buffer, filename, mimeType);
    return { success: true, url: result.webViewLink };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to upload receipt",
    };
  }
}
