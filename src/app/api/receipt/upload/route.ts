import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { uploadReceipt } from "@/lib/google-drive";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
  };
  // Prefer browser MIME (correct for phone cameras); extension-only guess breaks HEIC and some mobile uploads.
  const mimeFromClient = file.type?.trim();
  const mimeType =
    mimeFromClient && mimeFromClient.startsWith("image/")
      ? mimeFromClient
      : mimeMap[ext] || "image/jpeg";
  const filename = `receipt_${Date.now()}.${ext}`;

  try {
    const result = await uploadReceipt(buffer, filename, mimeType);
    return NextResponse.json({ success: true, url: result.webViewLink });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
